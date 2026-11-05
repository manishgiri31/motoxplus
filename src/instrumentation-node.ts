/**
 * The actual Node-only boot logic, split out of instrumentation.ts so it lives
 * in its own module (see the comment in instrumentation.ts for why the split
 * itself, not just a runtime `if`, is what keeps ioredis out of the Edge and
 * production webpack bundles). Runs once, as this module's top-level code,
 * the moment instrumentation.ts dynamically imports it.
 */
import { getMissingEnvVars } from "@/lib/env";
import { checkRedis } from "@/lib/redis";

const missing = getMissingEnvVars();

if (missing.length > 0) {
  console.error(
    "\n[Boot] Refusing to start — missing or placeholder required environment variable(s):\n" +
      missing.map((v) => `  - ${v}`).join("\n") +
      "\n\nCopy .env.example to .env and fill in real values.\n"
  );
  process.exit(1);
}
console.log("[Boot] Environment validation passed.");

try {
  await import("@/lib/delhivery/config");
  console.log("[Boot] Delhivery config validated.");
} catch (err) {
  console.error(
    "\n[Boot] Refusing to start — Delhivery configuration is invalid:\n" +
      `  ${err instanceof Error ? err.message : String(err)}\n`
  );
  process.exit(1);
}

// Verified with a real PING, not just "REDIS_URL is set". A Redis outage must NOT stop the app from
// booting (rate limiting fails open to the in-memory fallback - see rate-limit-budgets.ts), so an
// unreachable Redis is a loud warning here, never an exit.
const redisStatus = await checkRedis();
if (redisStatus.status === "ok") {
  console.log(`[Boot] Rate limiter: Redis OK (PING ${redisStatus.latencyMs}ms) - shared across all PM2 workers.`);
} else if (redisStatus.status === "error") {
  console.warn(
    `\n[Boot] WARNING: REDIS_URL is set but Redis is not answering (${redisStatus.reason}). ` +
      "Rate limits are falling back to per-worker in-memory counters (each PM2 worker counts separately, so the effective limit is multiplied by the core count). " +
      "Start/fix Redis; the app will pick it up automatically once it responds.\n"
  );
} else {
  console.log(
    "[Boot] Rate limiter: in-memory (per-worker — set REDIS_URL in production so limits are shared across PM2 cluster workers instead of multiplied by core count)."
  );
}
