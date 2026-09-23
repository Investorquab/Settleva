import { NextResponse } from "next/server";
import { ReclaimProofRequest, verifyProof } from "@reclaimprotocol/js-sdk";

export const runtime = "nodejs";

export async function POST(request: Request) {
  try {
    const body = await request.json() as {
      proofs?: unknown;
      expectedContext?: string;
    };

    if (!Array.isArray(body.proofs) || body.proofs.length === 0) {
      return NextResponse.json({ error:"No proof supplied." }, { status:400 });
    }
    if (!body.expectedContext || typeof body.expectedContext !== "string") {
      return NextResponse.json({ error:"Expected proof context is required." }, { status:400 });
    }

    const appId = process.env.RECLAIM_APP_ID;
    const appSecret = process.env.RECLAIM_APP_SECRET;
    const configuredProviderId = process.env.RECLAIM_PROVIDER_ID;
    if (!appId || !appSecret || !configuredProviderId) {
      return NextResponse.json({ error:"Reclaim server credentials are not configured." }, { status:503 });
    }

    const requestConfig = await ReclaimProofRequest.init(appId, appSecret, configuredProviderId, { log:false });
    const { providerId, providerVersion } = requestConfig.getProviderVersion();

    const result = await verifyProof(body.proofs, { providerId, providerVersion });
    if (!result.isVerified) {
      return NextResponse.json({ verified:false, error:result.error?.message || "Reclaim rejected the proof." }, { status:400 });
    }

    const rawProofs = body.proofs as Array<Record<string, unknown>>;
    const contextMatches = rawProofs.some((proof) => {
      const claimInfo = proof.claimInfo as Record<string, unknown> | undefined;
      const nestedClaimInfo = proof.claimData as Record<string, unknown> | undefined;
      const context = claimInfo?.context ?? nestedClaimInfo?.context;
      return context === body.expectedContext;
    });

    if (!contextMatches) {
      return NextResponse.json({ verified:false, error:"Proof context does not match this Settleva payment." }, { status:400 });
    }

    return NextResponse.json({
      verified:true,
      providerId,
      providerVersion,
      data:result.data
    });
  } catch (error) {
    return NextResponse.json({
      verified:false,
      error:error instanceof Error ? error.message : "Proof verification failed."
    }, { status:500 });
  }
}
