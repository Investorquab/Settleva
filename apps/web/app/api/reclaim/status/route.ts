import { NextResponse } from "next/server";
import { ReclaimSessionStore } from "../../../../../lib/reclaim-session-store.js";

export const runtime = "nodejs";

export async function GET(request: Request) {
  const databaseUrl = process.env.DATABASE_URL;
  if (!databaseUrl) return NextResponse.json({error:"Replay database is not configured."},{status:503});
  const sessionId = new URL(request.url).searchParams.get("sessionId");
  if (!sessionId) return NextResponse.json({error:"sessionId is required."},{status:400});

  const sessions = new ReclaimSessionStore(databaseUrl);
  try {
    const session = await sessions.get(sessionId);
    if (!session) return NextResponse.json({error:"Unknown Reclaim session."},{status:404});
    return NextResponse.json({
      sessionId:session.sessionId,
      status:session.status,
      paymentId:session.paymentId,
      conditionHash:session.conditionHash,
      proof:session.proof,
      proofIdentifier:session.proofIdentifier,
      verificationSignature:session.verificationSignature,
      error:session.error
    });
  } finally {
    await sessions.close();
  }
}
