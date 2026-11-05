import { NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { checkRedis } from "@/lib/redis";

const START_TIME = Date.now();

type Check = { status: "ok" | "error" | "disabled"; latencyMs?: number; error?: string; reason?: string };

/**
 * GET /api/health - comprehensive health check (DB + Redis + uptime).
 *
 * Only the DATABASE decides the HTTP status. Redis is reported in the body but does not turn the response
 * into a 503: the app deliberately keeps serving when Redis is down (rate limits fall back to per-worker
 * memory), and deploy/rollback/monitor jobs treat a non-2xx here as "the site is broken". A Redis problem
 * shows up as `"status": "degraded"` plus `checks.redis.status: "error"` so it is visible, not silent.
 */
export async function GET() {
  const checks: Record<string, Check> = {};

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

  // Redis check: a real PING. "disabled" means REDIS_URL is unset (in-memory limiter by design).
  const redis = await checkRedis();
  checks.redis =
    redis.status === "ok"
      ? { status: "ok", latencyMs: redis.latencyMs }
      : redis.status === "disabled"
        ? { status: "disabled" }
        : { status: "error", latencyMs: redis.latencyMs, reason: redis.reason };

  const dbOk = checks.database.status === "ok";
  const allOk = dbOk && checks.redis.status !== "error";
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
      status: dbOk ? 200 : 503,
      headers: { "Cache-Control": "no-store" },
    }
  );
}
