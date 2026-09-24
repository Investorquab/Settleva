import { createHash, timingSafeEqual } from "node:crypto";
import { NextResponse } from "next/server";
import { ReclaimSessionStore } from "../../../../lib/reclaim-session-store.js";

export const runtime = "nodejs";

export async function GET(request: Request) {
  const databaseUrl = process.env.DATABASE_URL;
  if (!databaseUrl) return NextResponse.json({error:"Replay database is not configured."},{status:503});
  const url = new URL(request.url);
  const sessionId = url.searchParams.get("sessionId");
  const statusToken = url.searchParams.get("statusToken");
  if (!sessionId || !statusToken) return NextResponse.json({error:"sessionId and statusToken are required."},{status:400});

  const sessions = new ReclaimSessionStore(databaseUrl);
  try {
    const session = await sessions.get(sessionId);
    if (!session) return NextResponse.json({error:"Unknown Reclaim session."},{status:404});
    if (!session.statusTokenHash) return NextResponse.json({error:"Reclaim session status access is not configured."},{status:503});
    const suppliedHash = Buffer.from(createHash("sha256").update(statusToken).digest("hex"), "utf8");
    const storedHash = Buffer.from(session.statusTokenHash, "utf8");
    if (suppliedHash.length !== storedHash.length || !timingSafeEqual(suppliedHash, storedHash)) {
      return NextResponse.json({error:"Invalid Reclaim session status token."},{status:403});
    }
    const response: Record<string, unknown> = {
      sessionId:session.sessionId,
      status:session.status
    };

    if (session.status === "verified") {
      response.paymentId = session.paymentId;
      response.conditionHash = session.conditionHash;
      response.proof = session.proof;
      response.proofIdentifier = session.proofIdentifier;
      response.verificationSignature = session.verificationSignature;
    } else if (session.status === "failed") {
      response.error = session.error;
    }

    return NextResponse.json(response);
  } finally {
    await sessions.close();
  }
}
