import { NextResponse } from "next/server";
import { hashCondition, type PaymentCondition } from "@settleva/conditions";
import { verifyReclaimAndAttest } from "../../../lib/reclaim-verification.js";

export const runtime = "nodejs";

function isPaymentCondition(value: unknown): value is PaymentCondition {
  if (!value || typeof value !== "object") return false;
  const condition = value as Record<string, unknown>;
  return condition.version === "1.0"
    && typeof condition.provider === "string"
    && typeof condition.providerVersion === "string"
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

export async function POST(request: Request) {
  try {
    const body = await request.json() as {proofs?:unknown;expectedContext?:string;condition?:unknown;sessionId?:string};
    if (!Array.isArray(body.proofs) || body.proofs.length !== 1 || typeof body.expectedContext !== "string" || typeof body.sessionId !== "string") {
      return NextResponse.json({verified:false,error:"Proofs, expected context, and Reclaim session ID are required."},{status:400});
    }
    if (!isPaymentCondition(body.condition)) return NextResponse.json({verified:false,error:"The exact payment condition is required."},{status:400});
    const committed = parseProofContext(body.expectedContext);
    if (!committed) return NextResponse.json({verified:false,error:"Expected proof context is not a valid Settleva binding."},{status:400});

    const providerId = process.env.RECLAIM_PROVIDER_ID;
    const providerVersion = process.env.RECLAIM_PROVIDER_VERSION;
    if (!providerId || !providerVersion) return NextResponse.json({verified:false,error:"Pinned Reclaim provider configuration is missing."},{status:503});

    const result = await verifyReclaimAndAttest({
      proofs:body.proofs,
      sessionId:body.sessionId,
      condition:body.condition,
      expectedPaymentId:committed.paymentId,
      expectedConditionHash:committed.conditionHash,
      expectedProviderId:providerId,
      expectedProviderVersion:providerVersion
    });

    return NextResponse.json({verified:true,...result,data:undefined});
  } catch (error) {
    const message = error instanceof Error ? error.message : "Proof verification failed.";
    const status = message.includes("already been accepted") ? 409 : message.includes("database") ? 503 : 400;
    return NextResponse.json({verified:false,error:message},{status});
  }
}
