import { NextResponse } from "next/server";

/** GET /api/health/live — liveness probe (is the process alive?) */
export async function GET() {
  return NextResponse.json(
    { alive: true, ts: new Date().toISOString() },
    { headers: { "Cache-Control": "no-store" } }
  );
}
