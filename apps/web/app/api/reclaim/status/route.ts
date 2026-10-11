import { createHash, timingSafeEqual } from "node:crypto";
import { NextResponse } from "next/server";
import { ReclaimSessionStore } from "../../../../lib/reclaim-session-store.js";

export const runtime = "nodejs";

function privateJson(body: unknown, init?: ResponseInit) {
  const headers = new Headers(init?.headers);
  headers.set("Cache-Control", "no-store");
  return NextResponse.json(body, {...init, headers});
}

export async function GET() {
  return privateJson({error:"Use POST with sessionId and statusToken in a JSON body."},{status:405,headers:{Allow:"POST"}});
}

export async function POST(request: Request) {
  const databaseUrl = process.env.DATABASE_URL;
  if (!databaseUrl) return privateJson({error:"Replay database is not configured."},{status:503});
  let body: {sessionId?: unknown;statusToken?: unknown};
  try {
    body = await request.json() as {sessionId?: unknown;statusToken?: unknown};
  } catch {
    return privateJson({error:"Request body must be valid JSON."},{status:400});
  }
  const sessionId = typeof body.sessionId === "string" ? body.sessionId : "";
  const statusToken = typeof body.statusToken === "string" ? body.statusToken : "";
  if (!sessionId || !statusToken) return privateJson({error:"sessionId and statusToken are required."},{status:400});

  const sessions = new ReclaimSessionStore(databaseUrl);
  try {
    const session = await sessions.get(sessionId);
    if (!session) return privateJson({error:"Unknown Reclaim session."},{status:404});
    if (!session.statusTokenHash) return privateJson({error:"Reclaim session status access is not configured."},{status:503});
    const suppliedHash = Buffer.from(createHash("sha256").update(statusToken).digest("hex"), "utf8");
    const storedHash = Buffer.from(session.statusTokenHash, "utf8");
    if (suppliedHash.length !== storedHash.length || !timingSafeEqual(suppliedHash, storedHash)) {
      return privateJson({error:"Invalid Reclaim session status token."},{status:403});
    }
    const response: Record<string, unknown> = {
      sessionId:session.sessionId,
      status:session.status
    };

    if (session.status === "verified") {
      response.paymentId = session.paymentId;
      response.conditionHash = session.conditionHash;
      response.proofIdentifier = session.proofIdentifier;
      response.verificationSignature = session.verificationSignature;
    } else if (session.status === "failed") {
      response.error = session.error;
    }

    return privateJson(response);
  } finally {
    await sessions.close();
  }
}
