import { prisma } from "@/lib/prisma";
import { getRedis } from "@/lib/redis";
import { UNKNOWN_IP } from "./middleware";
import type Redis from "ioredis";

const LOCK_THRESHOLD = 5;
export const LOCK_DURATION_MINUTES = 30;

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

function peekInMemory(key: string, maxRequests: number): { allowed: boolean; retryAfterSeconds: number } {
  const now = Date.now();
  const entry = memoryStore.get(key);
  if (!entry || entry.resetAt < now) return { allowed: true, retryAfterSeconds: 0 };
  return { allowed: entry.count < maxRequests, retryAfterSeconds: Math.max(1, Math.ceil((entry.resetAt - now) / 1000)) };
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

// getRedis() creates its client lazily on first use and returns it
// synchronously, before the TCP+auth handshake completes. With
// enableOfflineQueue:false (deliberate — see redis.ts), a command issued
// during that handshake window is rejected outright instead of queued, so
// the very first rate-limit check after a cold start would fail closed even
// though Redis is perfectly healthy. This gives a brief bounded window for
// the handshake to finish; if it's still not ready after that (a genuine
// outage, not a cold-start race), eval() below rejects immediately exactly
// as before and falls through to the normal failMode handling.
const REDIS_READY_WAIT_MS = 300;

function waitForReady(redis: Redis): Promise<void> {
  if (redis.status === "ready") return Promise.resolve();
  return new Promise((resolve) => {
    const timer = setTimeout(resolve, REDIS_READY_WAIT_MS);
    redis.once("ready", () => {
      clearTimeout(timer);
      resolve();
    });
  });
}

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

  await waitForReady(redis);

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
  if (ip === UNKNOWN_IP) {
    console.warn("[RateLimit] Client IP unavailable (no X-Forwarded-For/X-Real-IP header) — skipping per-IP check rather than sharing one bucket across every unresolvable client. Verify Nginx sets `proxy_set_header X-Forwarded-For $proxy_add_x_forwarded_for;`.");
    return true;
  }
  const { allowed } = await checkRateLimit(`ip:${ip}`, { max: maxRequests, windowSeconds, failMode: "open" });
  return allowed;
}

/**
 * Read-only variant of checkRateLimit — reports whether `key` is currently
 * over budget without incrementing it. Used by callers (login, OTP verify)
 * that only want a genuine failure to count against the budget: gate on
 * peekRateLimit() before attempting the operation, then call checkRateLimit()
 * (to increment) only if the operation actually fails, and resetRateLimit()
 * if it succeeds. A plain checkRateLimit() call up front would count every
 * attempt — including successes and mere page-loads — against the same
 * "N failures" budget.
 */
export async function peekRateLimit(
  key: string,
  opts: { max: number; windowSeconds: number }
): Promise<{ allowed: boolean; retryAfterSeconds: number }> {
  const redis = getRedis();
  if (!redis) return peekInMemory(key, opts.max);

  await waitForReady(redis);
  try {
    const redisKey = `ratelimit:${key}`;
    const [countRaw, ttl] = await Promise.all([redis.get(redisKey), redis.ttl(redisKey)]);
    const count = countRaw ? Number(countRaw) : 0;
    return { allowed: count < opts.max, retryAfterSeconds: ttl > 0 ? ttl : opts.windowSeconds };
  } catch (err) {
    console.error("[RateLimit] Redis error on peek:", err);
    // A peek is advisory (the real gate is the increment in checkRateLimit),
    // so degrade to the in-memory view rather than failing the request here.
    return peekInMemory(key, opts.max);
  }
}

/** Clears a rate-limit key outright — used to reset a bucket on success. */
export async function resetRateLimit(key: string): Promise<void> {
  memoryStore.delete(key);
  const redis = getRedis();
  if (!redis) return;
  await waitForReady(redis);
  try {
    await redis.del(`ratelimit:${key}`);
  } catch (err) {
    console.error("[RateLimit] Redis error on reset:", err);
  }
}
