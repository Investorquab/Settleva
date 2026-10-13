import { NextResponse } from "next/server";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

function deferred() {
  return NextResponse.json(
    {
      enabled: false,
      status: "deferred",
      error: "Reclaim integration is not part of Settleva V1. The previous implementation is preserved under future-integrations/reclaim/."
    },
    { status: 410, headers: { "Cache-Control": "no-store", "X-Content-Type-Options": "nosniff" } }
  );
}

export async function GET() { return deferred(); }
export async function POST() { return deferred(); }
