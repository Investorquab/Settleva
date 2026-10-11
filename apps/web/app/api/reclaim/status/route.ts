import { createHash, timingSafeEqual } from "node:crypto";
import { NextResponse } from "next/server";
import { ReclaimSessionStore } from "../../../../lib/reclaim-session-store.js";
import { JsonRequestBodyError, readJsonRequestBody } from "../../../../lib/request-body.js";

export const runtime = "nodejs";

function privateJson(body: unknown, init?: ResponseInit) {
  const headers = new Headers(init?.headers);
  headers.set("Cache-Control", "no-store");
  headers.set("X-Content-Type-Options", "nosniff");
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
    body = await readJsonRequestBody<{sessionId?: unknown;statusToken?: unknown}>(request, 16 * 1024);
  } catch (error) {
    if (error instanceof JsonRequestBodyError) return privateJson({error:error.message},{status:error.status});
    return privateJson({error:"Request body could not be read."},{status:400});
  }

  const sessionId = typeof body.sessionId === "string" ? body.sessionId : "";
  const statusToken = typeof body.statusToken === "string" ? body.statusToken : "";
  if (!sessionId || sessionId.length > 256 || !/^[A-Za-z0-9_-]{43}$/.test(statusToken)) {
    return privateJson({error:"A valid sessionId and status token are required."},{status:400});
  }

  const sessions = new ReclaimSessionStore(databaseUrl);
  try {
    const session = await sessions.get(sessionId);
    if (!session || !session.statusTokenHash) {
      return privateJson({error:"Session not found or status token invalid."},{status:403});
    }
    const suppliedHash = createHash("sha256").update(statusToken).digest();
    const storedHash = /^[a-f0-9]{64}$/i.test(session.statusTokenHash)
      ? Buffer.from(session.statusTokenHash, "hex")
      : null;
    if (!storedHash || suppliedHash.length !== storedHash.length || !timingSafeEqual(suppliedHash, storedHash)) {
      return privateJson({error:"Session not found or status token invalid."},{status:403});
    }

    const response: Record<string, unknown> = {sessionId:session.sessionId,status:session.status};
    if (session.status === "verified") {
      response.paymentId = session.paymentId;
      response.conditionHash = session.conditionHash;
      response.proofIdentifier = session.proofIdentifier;
      response.verificationSignature = session.verificationSignature;
    } else if (session.status === "failed") {
      response.error = "Verified evidence did not satisfy the committed payment condition.";
    }
    return privateJson(response);
  } catch {
    return privateJson({error:"Could not read private session status. Try again later."},{status:503});
  } finally {
    await sessions.close().catch(() => undefined);
  }
}
