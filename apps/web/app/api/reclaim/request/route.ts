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
      !!claim
      && typeof claim === "object"
      && typeof (claim as Record<string, unknown>).field === "string"
      && (claim as Record<string, unknown>).operator === "equals"
      && typeof (claim as Record<string, unknown>).value === "string"
    );
}

export async function POST(request: Request) {
  try {
    const body = await request.json() as {
      context?: string;
      condition?: unknown;
    };

    if (!body.context || typeof body.context !== "string" || !/^0x[0-9a-fA-F]{64}$/.test(body.context)) {
      return NextResponse.json({ error:"A valid committed condition hash is required." }, { status:400 });
    }
    if (!isPaymentCondition(body.condition)) {
      return NextResponse.json({ error:"The exact payment condition is required." }, { status:400 });
    }

    const condition = body.condition;
    if (hashCondition(condition) !== body.context) {
      return NextResponse.json({ error:"Payment condition does not match its committed hash." }, { status:400 });
    }

    const appId = process.env.RECLAIM_APP_ID;
    const appSecret = process.env.RECLAIM_APP_SECRET;
    const providerId = process.env.RECLAIM_PROVIDER_ID;
    if (!appId || !appSecret || !providerId) {
      return NextResponse.json({ error:"Reclaim server credentials are not configured." }, { status:503 });
    }
    if (condition.provider !== providerId) {
      return NextResponse.json({ error:"Payment condition provider does not match the configured Reclaim provider." }, { status:400 });
    }

    const requestConfig = await ReclaimProofRequest.init(appId, appSecret, providerId, {
      log: false
    });
    requestConfig.setContext(body.context);
    requestConfig.setParams({
      settlevaConditionHash: body.context,
      settlevaClaims: JSON.stringify(condition.claims)
    });

    return NextResponse.json({
      request: requestConfig.toJsonString(),
      providerId: requestConfig.getProviderVersion().providerId,
      providerVersion: requestConfig.getProviderVersion().providerVersion
    });
  } catch (error) {
    return NextResponse.json({
      error: error instanceof Error ? error.message : "Could not create Reclaim request."
    }, { status:500 });
  }
}
