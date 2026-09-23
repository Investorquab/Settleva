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
    && Number.isSafeInteger(condition.expiresAt);
}

export async function POST(request: Request) {
  try {
    const body = await request.json() as {
      proofs?: unknown;
      expectedContext?: string;
      condition?: unknown;
    };

    if (!Array.isArray(body.proofs) || body.proofs.length === 0) {
      return NextResponse.json({ error:"No proof supplied." }, { status:400 });
    }
    if (!body.expectedContext || typeof body.expectedContext !== "string") {
      return NextResponse.json({ error:"Expected proof context is required." }, { status:400 });
    }
    if (!isPaymentCondition(body.condition)) {
      return NextResponse.json({ error:"The exact payment condition is required." }, { status:400 });
    }

    const condition = body.condition;
    const committedContext = hashCondition(condition);
    if (committedContext !== body.expectedContext) {
      return NextResponse.json({
        verified:false,
        error:"Payment condition does not match the committed proof context."
      }, { status:400 });
    }

    const appId = process.env.RECLAIM_APP_ID;
    const appSecret = process.env.RECLAIM_APP_SECRET;
    const configuredProviderId = process.env.RECLAIM_PROVIDER_ID;
    if (!appId || !appSecret || !configuredProviderId) {
      return NextResponse.json({ error:"Reclaim server credentials are not configured." }, { status:503 });
    }
    if (condition.provider !== configuredProviderId) {
      return NextResponse.json({
        verified:false,
        error:"Payment condition provider does not match the configured Reclaim provider."
      }, { status:400 });
    }

    const requestConfig = await ReclaimProofRequest.init(appId, appSecret, configuredProviderId, { log:false });
    const { providerId, providerVersion } = requestConfig.getProviderVersion();

    const result = await verifyProof(body.proofs, { providerId, providerVersion });
    if (!result.isVerified) {
      return NextResponse.json({
        verified:false,
        error:result.error?.message || "Reclaim rejected the proof."
      }, { status:400 });
    }

    const data = Array.isArray(result.data) ? result.data : [];
    const matchingProof = data.find((entry) => {
      const extracted = (entry as { extractedParameters?: unknown }).extractedParameters;
      return extracted && typeof extracted === "object";
    });

    if (!matchingProof) {
      return NextResponse.json({
        verified:false,
        error:"Reclaim proof is valid but contains no verified extracted parameters."
      }, { status:400 });
    }

    const extracted = (matchingProof as { extractedParameters: Record<string, unknown> }).extractedParameters;
    const claims = Object.entries(extracted).map(([field,value]) => ({
      field,
      value: String(value)
    }));

    const evaluation = evaluateClaims(condition, claims);
    if (!evaluation.valid) {
      return NextResponse.json({
        verified:false,
        error:"Condition failed.",
        failures:evaluation.failures,
        claims
      }, { status:400 });
    }

    const rawProofs = body.proofs as Array<Record<string, unknown>>;
    const parameterMatches = rawProofs.some((proof) => {
      const claimData = proof.claimData as Record<string, unknown> | undefined;
      const parameters = claimData?.parameters;
      if (typeof parameters !== "string") return false;
      try {
        const parsed = JSON.parse(parameters) as Record<string, unknown>;
        return parsed.settlevaConditionHash === body.expectedContext;
      } catch {
        return false;
      }
    });

    if (!parameterMatches) {
      return NextResponse.json({
        verified:false,
        error:"Reclaim proof parameters are not bound to this Settleva condition."
      }, { status:400 });
    }

    const contextMatches = data.some((entry) => {
      const context = (entry as { context?: unknown }).context;
      if (!context || typeof context !== "object") return false;
      const message = (context as { message?: unknown; contextMessage?: unknown }).message
        ?? (context as { contextMessage?: unknown }).contextMessage;
      return message === body.expectedContext;
    });

    if (!contextMatches) {
      return NextResponse.json({
        verified:false,
        error:"Proof context does not match this Settleva payment."
      }, { status:400 });
    }

    return NextResponse.json({
      verified:true,
      providerId,
      providerVersion,
      claims,
      data:result.data
    });
  } catch (error) {
    return NextResponse.json({
      verified:false,
      error:error instanceof Error ? error.message : "Proof verification failed."
    }, { status:500 });
  }
}
