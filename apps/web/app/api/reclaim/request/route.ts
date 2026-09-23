import { NextResponse } from "next/server";
import { ReclaimProofRequest } from "@reclaimprotocol/js-sdk";

export const runtime = "nodejs";

export async function POST(request: Request) {
  try {
    const { context } = await request.json() as { context?: string };
    if (!context || typeof context !== "string" || context.length > 512) {
      return NextResponse.json({ error:"A valid proof context is required." }, { status:400 });
    }

    const appId = process.env.RECLAIM_APP_ID;
    const appSecret = process.env.RECLAIM_APP_SECRET;
    const providerId = process.env.RECLAIM_PROVIDER_ID;
    if (!appId || !appSecret || !providerId) {
      return NextResponse.json({ error:"Reclaim server credentials are not configured." }, { status:503 });
    }

    const requestConfig = await ReclaimProofRequest.init(appId, appSecret, providerId, {
      log: false
    });
    requestConfig.setContext(context);
    requestConfig.setParams({
      settlevaConditionHash: context
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
