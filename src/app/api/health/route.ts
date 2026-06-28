import { NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";

const START_TIME = Date.now();

/** GET /api/health — comprehensive health check (DB + uptime) */
export async function GET() {
  const checks: Record<string, { status: "ok" | "error"; latencyMs?: number; error?: string }> = {};

  // Database check
  const dbStart = Date.now();
  try {
    await prisma.$queryRaw`SELECT 1`;
    checks.database = { status: "ok", latencyMs: Date.now() - dbStart };
  } catch (err) {
    checks.database = {
      status: "error",
      latencyMs: Date.now() - dbStart,
      error: err instanceof Error ? err.message : "Unknown error",
    };
  }

  const allOk = Object.values(checks).every((c) => c.status === "ok");
  const uptimeSeconds = Math.floor((Date.now() - START_TIME) / 1000);

  return NextResponse.json(
    {
      status: allOk ? "ok" : "degraded",
      uptime: uptimeSeconds,
      version: process.env.npm_package_version ?? "unknown",
      env: process.env.NODE_ENV,
      checks,
    },
    {
      status: allOk ? 200 : 503,
      headers: { "Cache-Control": "no-store" },
    }
  );
}
