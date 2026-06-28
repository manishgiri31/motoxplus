import { prisma } from "@/lib/prisma";

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

// In-memory IP rate limiter — effective on single-instance servers (Railway).
// For multi-instance deployments, replace with a Redis-backed implementation.
const ipStore = new Map<string, { count: number; resetAt: number }>();

// Purge expired entries every 5 minutes to prevent unbounded memory growth
setInterval(() => {
  const now = Date.now();
  for (const [key, entry] of ipStore) {
    if (entry.resetAt < now) ipStore.delete(key);
  }
}, 5 * 60 * 1000);

export function checkIPRateLimit(ip: string, maxRequests = 10, windowSeconds = 60): boolean {
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
