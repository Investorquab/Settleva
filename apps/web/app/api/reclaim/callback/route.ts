import { NextResponse } from "next/server";
import { ReclaimSessionStore } from "../../../../lib/reclaim-session-store.js";
import { ReclaimVerificationError, verifyReclaimAndAttest } from "../../../../lib/reclaim-verification.js";
import { resolveVerificationCommit, shouldMarkCallbackFailed } from "../../../../lib/reclaim-decision.js";

export const runtime = "nodejs";

function parseSessionId(proof: unknown): string | null {
  if (!proof || typeof proof !== "object") return null;
  const claimData = (proof as Record<string, unknown>).claimData;
  if (!claimData || typeof claimData !== "object") return null;
  const context = (claimData as Record<string, unknown>).context;
  if (typeof context !== "string") return null;
  try {
    const parsed = JSON.parse(context) as Record<string, unknown>;
    return typeof parsed.reclaimSessionId === "string" ? parsed.reclaimSessionId : null;
  } catch {
    return null;
  }
}

export async function POST(request: Request) {
  const databaseUrl = process.env.DATABASE_URL;
  if (!databaseUrl) return NextResponse.json({error:"Replay database is not configured."},{status:503});

  try {
    const raw = await request.json() as unknown;
    const proofs = Array.isArray(raw) ? raw : [raw];
    if (proofs.length !== 1) return NextResponse.json({error:"Exactly one Reclaim proof is required."},{status:400});

    const sessionId = parseSessionId(proofs[0]);
    if (!sessionId) return NextResponse.json({error:"Reclaim session binding is missing from the proof."},{status:400});

    const sessions = new ReclaimSessionStore(databaseUrl);
    try {
      const session = await sessions.get(sessionId);
      if (!session) return NextResponse.json({error:"Unknown Reclaim session."},{status:404});
      if (session.status === "verified") return NextResponse.json({received:true,verified:true,sessionId});
      if (session.status === "failed") return NextResponse.json({received:true,verified:false,sessionId,error:session.error || "Reclaim session has already failed."},{status:400});

      try {
        const result = await verifyReclaimAndAttest({
          proofs,
          sessionId,
          condition:session.condition,
          expectedPaymentId:session.paymentId,
          expectedConditionHash:session.conditionHash as `0x${string}`,
          expectedProviderId:session.providerId,
          expectedProviderVersion:session.providerVersion
        });

        const transitioned = await sessions.markVerified(sessionId,result.proof,result.proofIdentifier,result.verificationSignature);
        const commitStatus = resolveVerificationCommit(transitioned, transitioned ? "verified" : (await sessions.get(sessionId))?.status ?? null);
        if (commitStatus === "already-committed") {
          return NextResponse.json({received:true,verified:true,sessionId});
        }
        if (commitStatus === "conflict") {
          return NextResponse.json(
            {received:true,verified:false,sessionId,error:"Reclaim session changed state before verification could be committed."},
            {status:409}
          );
        }
        return NextResponse.json({received:true,verified:true,sessionId});
      } catch (error) {
        const message = error instanceof Error ? error.message : "Reclaim verification failed.";
        const retryable = error instanceof ReclaimVerificationError && (error.code === "DATABASE" || error.code === "REPLAY");
        const currentStatus = (await sessions.get(sessionId))?.status ?? null;
        if (shouldMarkCallbackFailed(retryable, currentStatus)) {
          await sessions.markFailed(sessionId,message);
        }
        const status = retryable
          ? (error instanceof ReclaimVerificationError && error.code === "REPLAY" ? 409 : 503)
          : 400;
        return NextResponse.json({received:true,verified:false,error:message},{status});
      }
    } finally {
      await sessions.close();
    }
  } catch (error) {
    return NextResponse.json({error:error instanceof Error ? error.message:"Could not process Reclaim callback."},{status:500});
  }
}
