import { createHash, randomBytes } from "node:crypto";
import { NextResponse } from "next/server";
import { ReclaimProofRequest } from "@reclaimprotocol/js-sdk";
import { hashCondition, type PaymentCondition } from "@settleva/conditions";
import type { Hex } from "viem";
import { ReclaimSessionStore } from "../../../../lib/reclaim-session-store.js";
import { buildReclaimProviderParams } from "../../../../lib/reclaim-binding.js";
import { isGitHubDeploymentCondition } from "@settleva/providers";
import {
  assertFundedPaymentOnchain,
  SettlementChainConfigurationError,
  SettlementChainRpcError,
  SettlementPaymentStateError
} from "../../../../lib/settlement-chain.js";

export const runtime = "nodejs";

function privateJson(body: unknown, init?: ResponseInit) {
  const headers = new Headers(init?.headers);
  headers.set("Cache-Control", "no-store");
  return NextResponse.json(body, {...init, headers});
}

function isPaymentCondition(value: unknown): value is PaymentCondition {
  if (!value || typeof value !== "object") return false;
  const condition = value as Record<string, unknown>;
  return condition.version === "1.0"
    && typeof condition.provider === "string"
    && typeof condition.providerVersion === "string"
    && condition.provider.trim().length > 0
    && condition.providerVersion.trim().length > 0
    && Array.isArray(condition.claims)
    && condition.claims.length > 0
    && typeof condition.expiresAt === "number"
    && Number.isSafeInteger(condition.expiresAt)
    && condition.expiresAt > Math.floor(Date.now() / 1000)
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
    const body = await request.json() as {context?: unknown;condition?: unknown};
    if (typeof body.context !== "string") return privateJson({error:"A payment-bound proof context is required."},{status:400});

    let context: {paymentId:string;conditionHash:`0x${string}`};
    try { context = JSON.parse(body.context) as {paymentId:string;conditionHash:`0x${string}`}; }
    catch { return privateJson({error:"Proof context is not valid JSON."},{status:400}); }

    if (!isProofContext(context)) return privateJson({error:"Proof context must bind paymentId and conditionHash."},{status:400});
    if (!isPaymentCondition(body.condition)) return privateJson({error:"The exact payment condition is required."},{status:400});

    const condition = body.condition;
    if (!isGitHubDeploymentCondition(condition)) {
      return privateJson({error:"Only the GitHub deployment-status evidence adapter is enabled for real settlement."},{status:400});
    }
    let providerParams: Record<string, string>;
    try {
      providerParams = buildReclaimProviderParams(condition);
    } catch (error) {
      return privateJson({error:error instanceof Error ? error.message:"GitHub deployment condition is invalid."},{status:400});
    }
    let computedConditionHash: Hex;
    try {
      computedConditionHash = hashCondition(condition);
    } catch (error) {
      return privateJson({error:error instanceof Error ? error.message : "Payment condition is invalid."},{status:400});
    }
    if (computedConditionHash.toLowerCase() !== context.conditionHash.toLowerCase()) {
      return privateJson({error:"Payment condition does not match its committed hash."},{status:400});
    }

    const appId = process.env.RECLAIM_APP_ID;
    const appSecret = process.env.RECLAIM_APP_SECRET;
    const providerId = process.env.RECLAIM_PROVIDER_ID;
    const configuredProviderVersion = process.env.RECLAIM_PROVIDER_VERSION;
    if (!appId || !appSecret || !providerId || !configuredProviderVersion) {
      return privateJson({error:"Reclaim server credentials and the pinned provider version are not configured."},{status:503});
    }
    if (condition.provider !== providerId) return privateJson({error:"Payment condition provider does not match the configured Reclaim provider."},{status:400});
    if (condition.providerVersion !== configuredProviderVersion) return privateJson({error:"Payment condition provider version does not match the configured Reclaim provider version."},{status:400});

    // Do not start a provider session for a made-up payment ID or a condition
    // that is not the exact commitment locked by the live Arc contract.
    await assertFundedPaymentOnchain(context.paymentId as Hex, condition, context.conditionHash);

    const requestConfig = await ReclaimProofRequest.init(appId,appSecret,providerId,{
      log:false,
      providerVersion:configuredProviderVersion,
      useBrowserExtension:false
    });
    const {providerId:resolvedProviderId,providerVersion} = requestConfig.getProviderVersion();
    if (resolvedProviderId !== providerId || providerVersion !== configuredProviderVersion) {
      return privateJson({error:"Configured Reclaim provider version does not match the provider version resolved for this request."},{status:503});
    }

    const callbackUrl = process.env.RECLAIM_CALLBACK_URL;
    const databaseUrl = process.env.DATABASE_URL;
    if (!callbackUrl || !databaseUrl) {
      return privateJson({error:"Production Reclaim callback and replay database configuration are required."},{status:503});
    }

    requestConfig.setAppCallbackUrl(callbackUrl, true);
    requestConfig.setParams(providerParams);
    requestConfig.setContext(context.paymentId, context.conditionHash);
    const sessionId = requestConfig.getSessionId();
    const statusToken = randomBytes(32).toString("base64url");
    const statusTokenHash = createHash("sha256").update(statusToken).digest("hex");

    const sessions = new ReclaimSessionStore(databaseUrl);
    try {
      const created = await sessions.create({
        sessionId,
        paymentId:context.paymentId,
        conditionHash:context.conditionHash,
        condition,
        providerId:resolvedProviderId,
        providerVersion,
        statusTokenHash
      });
      if (!created) throw new Error("Reclaim session ID collision; request was not created.");
    } finally {
      await sessions.close();
    }

    return privateJson({
      request:requestConfig.toJsonString(),
      sessionId,
      statusToken,
      providerId:resolvedProviderId,
      providerVersion
    });
  } catch (error) {
    const status = error instanceof SettlementChainConfigurationError || error instanceof SettlementChainRpcError
      ? 503
      : error instanceof SettlementPaymentStateError ? 409 : 500;
    return privateJson({error:error instanceof Error ? error.message:"Could not create Reclaim request."},{status});
  }
}
