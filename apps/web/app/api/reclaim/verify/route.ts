import { NextResponse } from "next/server";
import { ReclaimProofRequest, verifyProof } from "@reclaimprotocol/js-sdk";
import { evaluateClaims, hashCondition, type PaymentCondition } from "@settleva/conditions";

export const runtime = "nodejs";

function isPaymentCondition(value: unknown): value is PaymentCondition {
  if (!value || typeof value !== "object") return false;
  const condition = value as Record<string, unknown>;
  return condition.version === "1.0"
    && typeof condition.provider === "string"
    && Array.isArray(condition.claims)
    && Number.isSafeInteger(condition.expiresAt)
    && condition.claims.every((claim) =>
      !!claim && typeof claim === "object"
      && typeof (claim as Record<string, unknown>).field === "string"
      && (claim as Record<string, unknown>).operator === "equals"
      && typeof (claim as Record<string, unknown>).value === "string"
    );
}

function parseProofContext(value: string): {paymentId:string;conditionHash:`0x${string}`} | null {
  try {
    const parsed = JSON.parse(value) as Record<string, unknown>;
    if (typeof parsed.paymentId !== "string" || !/^0x[0-9a-fA-F]{64}$/.test(parsed.paymentId)) return null;
    if (typeof parsed.conditionHash !== "string" || !/^0x[0-9a-fA-F]{64}$/.test(parsed.conditionHash)) return null;
    return {paymentId:parsed.paymentId,conditionHash:parsed.conditionHash as `0x${string}`};
  } catch { return null; }
}

function normalizeClaims(claims: unknown[]): string {
  return JSON.stringify(
    claims.map((claim) => {
      const item = claim as Record<string, unknown>;
      return {field:String(item.field),operator:String(item.operator),value:String(item.value)};
    }).sort((a,b) =>
      a.field.localeCompare(b.field) || a.operator.localeCompare(b.operator) || a.value.localeCompare(b.value)
    )
  );
}

export async function POST(request: Request) {
  try {
    const body = await request.json() as {proofs?:unknown;expectedContext?:string;condition?:unknown};
    if (!Array.isArray(body.proofs) || body.proofs.length === 0) return NextResponse.json({error:"No proof supplied."},{status:400});
    if (typeof body.expectedContext !== "string") return NextResponse.json({error:"Expected proof context is required."},{status:400});
    if (!isPaymentCondition(body.condition)) return NextResponse.json({error:"The exact payment condition is required."},{status:400});

    const committed = parseProofContext(body.expectedContext);
    if (!committed) return NextResponse.json({verified:false,error:"Expected proof context is not a valid Settleva binding."},{status:400});
    if (hashCondition(body.condition) !== committed.conditionHash) {
      return NextResponse.json({verified:false,error:"Payment condition does not match the committed proof context."},{status:400});
    }

    const appId = process.env.RECLAIM_APP_ID;
    const appSecret = process.env.RECLAIM_APP_SECRET;
    const configuredProviderId = process.env.RECLAIM_PROVIDER_ID;
    if (!appId || !appSecret || !configuredProviderId) return NextResponse.json({error:"Reclaim server credentials are not configured."},{status:503});
    if (body.condition.provider !== configuredProviderId) return NextResponse.json({verified:false,error:"Payment condition provider does not match the configured Reclaim provider."},{status:400});

    const requestConfig = await ReclaimProofRequest.init(appId, appSecret, configuredProviderId, {log:false});
    const {providerId,providerVersion} = requestConfig.getProviderVersion();
    const result = await verifyProof(body.proofs,{providerId,providerVersion});
    if (!result.isVerified) return NextResponse.json({verified:false,error:result.error?.message || "Reclaim rejected the proof."},{status:400});

    const data = Array.isArray(result.data) ? result.data : [];
    const matchingProof = data.find((entry) => {
      const extracted = (entry as {extractedParameters?:unknown}).extractedParameters;
      return extracted && typeof extracted === "object";
    });
    if (!matchingProof) return NextResponse.json({verified:false,error:"Reclaim proof is valid but contains no verified extracted parameters."},{status:400});

    const extracted = (matchingProof as {extractedParameters:Record<string,unknown>}).extractedParameters;
    const claims = Object.entries(extracted).map(([field,value]) => ({field,value:String(value)}));
    const evaluation = evaluateClaims(body.condition,claims);
    if (!evaluation.valid) return NextResponse.json({verified:false,error:"Condition failed.",failures:evaluation.failures,claims},{status:400});

    const rawProofs = body.proofs as Array<Record<string,unknown>>;
    const parameterMatches = rawProofs.some((proof) => {
      const claimData = proof.claimData as Record<string,unknown> | undefined;
      if (typeof claimData?.parameters !== "string") return false;
      try {
        const parsed = JSON.parse(claimData.parameters) as Record<string,unknown>;
        if (parsed.settlevaPaymentId !== committed.paymentId) return false;
        if (parsed.settlevaConditionHash !== committed.conditionHash) return false;
        if (typeof parsed.settlevaClaims !== "string") return false;
        const requested = JSON.parse(parsed.settlevaClaims) as unknown;
        return Array.isArray(requested) && normalizeClaims(requested) === normalizeClaims(body.condition.claims);
      } catch { return false; }
    });
    if (!parameterMatches) return NextResponse.json({verified:false,error:"Reclaim proof parameters are not bound to this Settleva payment and condition."},{status:400});

    const contextMatches = data.some((entry) => {
      const context = (entry as {context?:unknown}).context;
      if (!context || typeof context !== "object") return false;
      const message = (context as {message?:unknown;contextMessage?:unknown}).message
        ?? (context as {contextMessage?:unknown}).contextMessage;
      return message === body.expectedContext;
    });
    if (!contextMatches) return NextResponse.json({verified:false,error:"Proof context does not match this Settleva payment."},{status:400});

    return NextResponse.json({verified:true,providerId,providerVersion,claims,data:result.data});
  } catch (error) {
    return NextResponse.json({verified:false,error:error instanceof Error ? error.message:"Proof verification failed."},{status:500});
  }
}
