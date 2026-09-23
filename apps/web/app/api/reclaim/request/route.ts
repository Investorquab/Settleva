import { NextResponse } from "next/server";
import { ReclaimProofRequest } from "@reclaimprotocol/js-sdk";
import { hashCondition, type PaymentCondition } from "@settleva/conditions";

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

function isProofContext(value: unknown): value is {paymentId:string;conditionHash:`0x${string}`} {
  if (!value || typeof value !== "object") return false;
  const context = value as Record<string, unknown>;
  return typeof context.paymentId === "string"
    && /^0x[0-9a-fA-F]{64}$/.test(context.paymentId)
    && typeof context.conditionHash === "string"
    && /^0x[0-9a-fA-F]{64}$/.test(context.conditionHash);
}

export async function POST(request: Request) {
  try {
    const body = await request.json() as { context?: unknown; condition?: unknown };
    if (typeof body.context !== "string") {
      return NextResponse.json({error:"A payment-bound proof context is required."},{status:400});
    }
    let context: {paymentId:string;conditionHash:`0x${string}`};
    try { context = JSON.parse(body.context) as {paymentId:string;conditionHash:`0x${string}`}; }
    catch { return NextResponse.json({error:"Proof context is not valid JSON."},{status:400}); }
    if (!isProofContext(context)) return NextResponse.json({error:"Proof context must bind paymentId and conditionHash."},{status:400});
    if (!isPaymentCondition(body.condition)) return NextResponse.json({error:"The exact payment condition is required."},{status:400});

    const condition = body.condition;
    if (hashCondition(condition) !== context.conditionHash) {
      return NextResponse.json({error:"Payment condition does not match its committed hash."},{status:400});
    }

    const appId = process.env.RECLAIM_APP_ID;
    const appSecret = process.env.RECLAIM_APP_SECRET;
    const providerId = process.env.RECLAIM_PROVIDER_ID;
    if (!appId || !appSecret || !providerId) {
      return NextResponse.json({error:"Reclaim server credentials are not configured."},{status:503});
    }
    if (condition.provider !== providerId) {
      return NextResponse.json({error:"Payment condition provider does not match the configured Reclaim provider."},{status:400});
    }

    const requestConfig = await ReclaimProofRequest.init(appId, appSecret, providerId, {log:false});
    requestConfig.setContext(body.context);
    requestConfig.setParams({
      settlevaPaymentId: context.paymentId,
      settlevaConditionHash: context.conditionHash,
      settlevaClaims: JSON.stringify(condition.claims)
    });

    return NextResponse.json({
      request: requestConfig.toJsonString(),
      providerId: requestConfig.getProviderVersion().providerId,
      providerVersion: requestConfig.getProviderVersion().providerVersion
    });
  } catch (error) {
    return NextResponse.json({error:error instanceof Error ? error.message:"Could not create Reclaim request."},{status:500});
  }
}
