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

// In-memory IP rate limiter — fallback when REDIS_URL isn't configured.
// Only effective on single-instance servers: ecosystem.config.js runs PM2 in
// cluster mode with `instances: "max"` (one worker per CPU core), and each
// worker has its own independent Map. Under cluster mode the *effective*
// limit is silently multiplied by the number of workers — e.g. on a 4-core
// box, "5 requests/60s per IP" actually allows ~20/60s, since requests
// round-robin across workers that don't share this Map. Set REDIS_URL in
// production so the counter below is shared across all workers instead.
const ipStore = new Map<string, { count: number; resetAt: number }>();

// Purge expired entries every 5 minutes to prevent unbounded memory growth
setInterval(() => {
  const now = Date.now();
  ipStore.forEach((entry, key) => {
    if (entry.resetAt < now) ipStore.delete(key);
  });
}, 5 * 60 * 1000);

function checkIPRateLimitInMemory(ip: string, maxRequests: number, windowSeconds: number): boolean {
  const now = Date.now();
  const entry = ipStore.get(ip);

  if (!entry || entry.resetAt < now) {
    ipStore.set(ip, { count: 1, resetAt: now + windowSeconds * 1000 });
    return true;
  }

  if (entry.count >= maxRequests) return false;
  entry.count++;
  return true;
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

export async function checkIPRateLimit(ip: string, maxRequests = 10, windowSeconds = 60): Promise<boolean> {
  const redis = getRedis();
  if (!redis) return checkIPRateLimitInMemory(ip, maxRequests, windowSeconds);

  try {
    const count = (await redis.eval(RATE_LIMIT_SCRIPT, 1, `ratelimit:${ip}`, windowSeconds)) as number;
    return count <= maxRequests;
  } catch (err) {
    // Redis hiccup shouldn't take down login/OTP endpoints — degrade to the
    // (weaker, per-worker) in-memory limiter rather than failing the request.
    console.error("[RateLimit] Redis error, falling back to in-memory:", err);
    return checkIPRateLimitInMemory(ip, maxRequests, windowSeconds);
  }
}
