import { prisma } from "@/lib/prisma";
import { getRedis } from "@/lib/redis";

const LOCK_THRESHOLD = 5;
const LOCK_DURATION_MINUTES = 30;

export async function recordFailedLogin(userId: string): Promise<{ locked: boolean; attemptsLeft: number }> {
  const user = await prisma.user.update({
    where: { id: userId },
    data: { failedLoginAttempts: { increment: 1 } },
    select: { failedLoginAttempts: true },
  });

  if (user.failedLoginAttempts >= LOCK_THRESHOLD) {
    const lockedUntil = new Date(Date.now() + LOCK_DURATION_MINUTES * 60 * 1000);
    await prisma.user.update({
      where: { id: userId },
      data: { accountLockedUntil: lockedUntil },
    });
    return { locked: true, attemptsLeft: 0 };
  }

  return {
    locked: false,
    attemptsLeft: LOCK_THRESHOLD - user.failedLoginAttempts,
  };
}

export async function clearFailedLogins(userId: string) {
  await prisma.user.update({
    where: { id: userId },
    data: { failedLoginAttempts: 0, accountLockedUntil: null },
  });
}

export async function isAccountLocked(userId: string): Promise<{ locked: boolean; until?: Date }> {
  const user = await prisma.user.findUnique({
    where: { id: userId },
    select: { accountLockedUntil: true },
  });

  if (!user?.accountLockedUntil) return { locked: false };
  if (user.accountLockedUntil > new Date()) return { locked: true, until: user.accountLockedUntil };

  // Auto-unlock after duration passes
  await clearFailedLogins(userId);
  return { locked: false };
}

// In-memory keyed rate limiter — fallback when REDIS_URL isn't configured
// (or, for failMode:"open" callers, when Redis is momentarily unreachable).
// Only effective on single-instance servers: ecosystem.config.js runs PM2 in
// cluster mode with `instances: "max"` (one worker per CPU core), and each
// worker has its own independent Map. Under cluster mode the *effective*
// limit is silently multiplied by the number of workers — e.g. on a 4-core
// box, "5 requests/60s" actually allows ~20/60s, since requests round-robin
// across workers that don't share this Map. Set REDIS_URL in production so
// the counter below is shared across all workers instead.
const memoryStore = new Map<string, { count: number; resetAt: number }>();

// Purge expired entries every 5 minutes to prevent unbounded memory growth
setInterval(() => {
  const now = Date.now();
  memoryStore.forEach((entry, key) => {
    if (entry.resetAt < now) memoryStore.delete(key);
  });
}, 5 * 60 * 1000);

function checkInMemory(key: string, maxRequests: number, windowSeconds: number): { allowed: boolean; retryAfterSeconds: number } {
  const now = Date.now();
  const entry = memoryStore.get(key);

  if (!entry || entry.resetAt < now) {
    memoryStore.set(key, { count: 1, resetAt: now + windowSeconds * 1000 });
    return { allowed: true, retryAfterSeconds: windowSeconds };
  }

  const retryAfterSeconds = Math.max(1, Math.ceil((entry.resetAt - now) / 1000));
  if (entry.count >= maxRequests) return { allowed: false, retryAfterSeconds };
  entry.count++;
  return { allowed: true, retryAfterSeconds };
}

// Atomic increment-and-expire in one round trip: without the Lua script, a
// plain INCR followed by a separate EXPIRE call is two round trips and not
// atomic — a crash or concurrent request between them can leave the key
// without a TTL, or reset the TTL on every request instead of only the first.
const RATE_LIMIT_SCRIPT = `
local current = redis.call("INCR", KEYS[1])
if current == 1 then
  redis.call("EXPIRE", KEYS[1], ARGV[1])
end
return current
`;

export type FailMode = "open" | "closed";

/**
 * The one primitive every rate limit in the app goes through — arbitrary
 * key (caller decides the namespace: "ip:...", "id:...", etc.), a budget,
 * and a fail-open/fail-closed choice for what happens if Redis is down. See
 * rate-limit-budgets.ts for the actual per-route-class budgets and the
 * failMode reasoning.
 */
export async function checkRateLimit(
  key: string,
  opts: { max: number; windowSeconds: number; failMode?: FailMode }
): Promise<{ allowed: boolean; retryAfterSeconds: number }> {
  const { max, windowSeconds, failMode = "open" } = opts;
  const redis = getRedis();

  if (!redis) {
    if (failMode === "closed") return { allowed: false, retryAfterSeconds: windowSeconds };
    return checkInMemory(key, max, windowSeconds);
  }

  try {
    const count = (await redis.eval(RATE_LIMIT_SCRIPT, 1, `ratelimit:${key}`, windowSeconds)) as number;
    return { allowed: count <= max, retryAfterSeconds: windowSeconds };
  } catch (err) {
    console.error("[RateLimit] Redis error:", err);
    if (failMode === "closed") return { allowed: false, retryAfterSeconds: windowSeconds };
    // Read-only/public routes shouldn't go down over a Redis blip — degrade
    // to the (weaker, per-worker) in-memory limiter instead of failing the request.
    return checkInMemory(key, max, windowSeconds);
  }
}

// Back-compat wrapper — existing call sites across the app use this
// IP-only, fail-open shape. New routes should prefer enforceRateLimit() in
// rate-limit-budgets.ts, which adds per-identifier budgets, Retry-After, and
// explicit fail-open/closed per route class.
export async function checkIPRateLimit(ip: string, maxRequests = 10, windowSeconds = 60): Promise<boolean> {
  const { allowed } = await checkRateLimit(`ip:${ip}`, { max: maxRequests, windowSeconds, failMode: "open" });
  return allowed;
}
