import { NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";

/** GET /api/health/ready — readiness probe (is the app ready to serve traffic?) */
export async function GET() {
  try {
    await prisma.$queryRaw`SELECT 1`;
    return NextResponse.json({ ready: true }, { headers: { "Cache-Control": "no-store" } });
  } catch {
    return NextResponse.json(
      { ready: false, reason: "Database unavailable" },
      { status: 503, headers: { "Cache-Control": "no-store" } }
    );
  }
}
