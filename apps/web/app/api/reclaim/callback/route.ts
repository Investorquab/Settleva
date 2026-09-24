import { NextResponse } from "next/server";
import { ReclaimSessionStore } from "../../../lib/reclaim-session-store.js";
import { verifyReclaimAndAttest } from "../../../lib/reclaim-verification.js";

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

        await sessions.markVerified(sessionId,result.proof,result.proofIdentifier,result.verificationSignature);
        return NextResponse.json({received:true,verified:true,sessionId});
      } catch (error) {
        const message = error instanceof Error ? error.message : "Reclaim verification failed.";
        if (!message.includes("database") && !message.includes("already been accepted")) {
          await sessions.markFailed(sessionId,message);
        }
        return NextResponse.json({received:true,verified:false,error:message},{status:400});
      }
    } finally {
      await sessions.close();
    }
  } catch (error) {
    return NextResponse.json({error:error instanceof Error ? error.message:"Could not process Reclaim callback."},{status:500});
  }
}
