import { NextResponse } from "next/server";
import { ReclaimSessionStore } from "../../../../lib/reclaim-session-store.js";
import { verifyReclaimAndAttest, ReclaimVerificationError } from "../../../../lib/reclaim-verification.js";

export const runtime = "nodejs";

function privateJson(body: unknown, init?: ResponseInit) {
  const headers = new Headers(init?.headers);
  headers.set("Cache-Control", "no-store");
  return NextResponse.json(body, {...init, headers});
}

export async function POST(request: Request) {
  const databaseUrl = process.env.DATABASE_URL;
  if (!databaseUrl) {
    return privateJson(
      {verified:false,error:"Replay database is not configured."},
      {status:503}
    );
  }

  try {
    const body = await request.json() as {proofs?:unknown;sessionId?:string};
    if (!Array.isArray(body.proofs) || body.proofs.length !== 1 || typeof body.sessionId !== "string" || !body.sessionId) {
      return privateJson(
        {verified:false,error:"Exactly one proof and its initiated Reclaim session ID are required."},
        {status:400}
      );
    }

    const sessions = new ReclaimSessionStore(databaseUrl);
    try {
      const session = await sessions.get(body.sessionId);
      if (!session) {
        return privateJson({verified:false,error:"Unknown Reclaim session."},{status:404});
      }
      if (session.status === "verified") {
        return privateJson({verified:true,sessionId:session.sessionId});
      }
      if (session.status === "failed") {
        return privateJson(
          {verified:false,error:session.error || "Reclaim session has already failed."},
          {status:400}
        );
      }

      const result = await verifyReclaimAndAttest({
        proofs:body.proofs,
        sessionId:session.sessionId,
        condition:session.condition,
        expectedPaymentId:session.paymentId,
        expectedConditionHash:session.conditionHash as `0x${string}`,
        expectedProviderId:session.providerId,
        expectedProviderVersion:session.providerVersion
      });

      let committed = false;
      try {
        committed = await sessions.markVerified(
          session.sessionId,
          result.proof,
          result.proofIdentifier,
          result.verificationSignature
        );
      } catch {
        const current = await sessions.get(session.sessionId);
        if (current?.status === "verified") {
          return privateJson({verified:true,sessionId:session.sessionId});
        }
        throw new Error("Could not persist verification result.");
      }

      if (!committed) {
        const current = await sessions.get(session.sessionId);
        if (current?.status === "verified") {
          return privateJson({verified:true,sessionId:session.sessionId});
        }
        return privateJson(
          {verified:false,error:"Reclaim session changed state before verification could be committed."},
          {status:409}
        );
      }

      return privateJson({
        verified:true,
        sessionId:session.sessionId,
        paymentId:session.paymentId,
        conditionHash:session.conditionHash,
        proofIdentifier:result.proofIdentifier,
        verificationSignature:result.verificationSignature,
        verificationSigner:result.verificationSigner
      });
    } finally {
      await sessions.close();
    }
  } catch (error) {
    const message = error instanceof Error ? error.message : "Proof verification failed.";
    const status =
      error instanceof ReclaimVerificationError && error.code === "REPLAY" ? 409 :
      error instanceof ReclaimVerificationError && (error.code === "DATABASE" || error.code === "CHAIN") ? 503 :
      message.includes("database") ? 503 : 400;
    return privateJson({verified:false,error:message},{status});
  }
}
