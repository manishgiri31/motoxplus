/**
 * The actual Node-only boot logic, split out of instrumentation.ts so it lives
 * in its own module (see the comment in instrumentation.ts for why the split
 * itself, not just a runtime `if`, is what keeps ioredis out of the Edge and
 * production webpack bundles). Runs once, as this module's top-level code,
 * the moment instrumentation.ts dynamically imports it.
 */
import { getMissingEnvVars } from "@/lib/env";
import { getRedis } from "@/lib/redis";

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

const redis = getRedis();
console.log(
  redis
    ? "[Boot] Rate limiter: Redis (shared across all PM2 workers)."
    : "[Boot] Rate limiter: in-memory (per-worker — set REDIS_URL in production so limits are shared across PM2 cluster workers instead of multiplied by core count)."
);
