import { NextResponse } from "next/server";
import { verifyProof } from "@reclaimprotocol/js-sdk";

export const runtime = "nodejs";

export async function POST(request: Request) {
  try {
    const body = await request.json() as {
      proofs?: unknown;
      providerId?: string;
      providerVersion?: string;
      expectedContext?: string;
    };

    if (!Array.isArray(body.proofs) || body.proofs.length === 0) {
      return NextResponse.json({ error:"No proof supplied." }, { status:400 });
    }
    if (!body.providerId || !body.providerVersion || !body.expectedContext) {
      return NextResponse.json({ error:"Provider version and expected context are required." }, { status:400 });
    }

    const result = await verifyProof(body.proofs, {
      providerId: body.providerId,
      providerVersion: body.providerVersion
    });

    if (!result.isVerified) {
      return NextResponse.json({ verified:false, error:result.error?.message || "Reclaim rejected the proof." }, { status:400 });
    }

    const matching = result.data.some((item) => item.context === body.expectedContext);
    if (!matching) {
      return NextResponse.json({ verified:false, error:"Proof context does not match this Settleva payment." }, { status:400 });
    }

    return NextResponse.json({ verified:true, data:result.data });
  } catch (error) {
    return NextResponse.json({
      verified:false,
      error:error instanceof Error ? error.message : "Proof verification failed."
    }, { status:500 });
  }
}
