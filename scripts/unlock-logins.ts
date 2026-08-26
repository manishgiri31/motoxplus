/**
 * Emergency escape hatch for a site-wide login lockout: clears every
 * Redis-backed LOGIN rate-limit counter (rl:LOGIN:id:* and rl:LOGIN:ip:*) and
 * every DB-backed account lock (failedLoginAttempts/accountLockedUntil).
 *
 * The admin "unlock this one user" button (POST
 * /api/admin/users/[id]/unlock-login) already covers the single-account
 * case. This is for the other one: a lockout hitting many/all accounts at
 * once, where clicking through the admin UI per-user isn't practical.
 *
 * Usage:
 *   npx ts-node --compiler-options '{"module":"CommonJS"}' scripts/unlock-logins.ts --dry-run
 *   npx ts-node --compiler-options '{"module":"CommonJS"}' scripts/unlock-logins.ts --yes
 *
 * --dry-run   Report what would be cleared without changing anything (default
 *             if neither flag is given — this script never mutates by accident).
 * --yes       Actually clear the counters and DB locks.
 *
 * Uses SCAN (not KEYS) so it doesn't block a production Redis while walking
 * the keyspace.
 */
import { PrismaClient } from "@prisma/client";
import Redis from "ioredis";

const DRY_RUN = !process.argv.includes("--yes");

async function scanKeys(redis: Redis, pattern: string): Promise<string[]> {
  const found: string[] = [];
  let cursor = "0";
  do {
    const [next, keys] = await redis.scan(cursor, "MATCH", pattern, "COUNT", 500);
    cursor = next;
    found.push(...keys);
  } while (cursor !== "0");
  return found;
}

async function main() {
  const redisUrl = process.env.REDIS_URL;
  if (!redisUrl) {
    console.log("[unlock-logins] REDIS_URL not set — nothing to do at the Redis layer (this deployment is using the in-memory fallback, which is per-process and clears itself on restart).");
  }

  const redis = redisUrl ? new Redis(redisUrl, { maxRetriesPerRequest: 1, commandTimeout: 5000 }) : null;
  const prisma = new PrismaClient();

  try {
    let loginKeys: string[] = [];
    if (redis) {
      loginKeys = await scanKeys(redis, "ratelimit:rl:LOGIN:*");
      console.log(`[unlock-logins] Found ${loginKeys.length} Redis LOGIN rate-limit key(s).`);
      for (const key of loginKeys.slice(0, 20)) console.log(`  ${key}`);
      if (loginKeys.length > 20) console.log(`  ...and ${loginKeys.length - 20} more`);
    }

    const lockedUsers = await prisma.user.findMany({
      where: { OR: [{ accountLockedUntil: { not: null } }, { failedLoginAttempts: { gt: 0 } }] },
      select: { id: true, email: true, mobileNumber: true, failedLoginAttempts: true, accountLockedUntil: true },
    });
    console.log(`[unlock-logins] Found ${lockedUsers.length} user(s) with a nonzero failed-attempt count or an active lock.`);
    for (const u of lockedUsers.slice(0, 20)) {
      console.log(`  ${u.email ?? u.mobileNumber} — attempts=${u.failedLoginAttempts} lockedUntil=${u.accountLockedUntil?.toISOString() ?? "-"}`);
    }
    if (lockedUsers.length > 20) console.log(`  ...and ${lockedUsers.length - 20} more`);

    if (DRY_RUN) {
      console.log("\n[unlock-logins] Dry run — nothing changed. Re-run with --yes to actually clear these.");
      return;
    }

    if (redis && loginKeys.length > 0) {
      // del() takes a variadic key list, not an array — SCAN can turn up
      // thousands of keys on a real incident, so this chunks the delete
      // instead of blowing past Redis's per-command argument limits.
      const CHUNK = 500;
      for (let i = 0; i < loginKeys.length; i += CHUNK) {
        await redis.del(...loginKeys.slice(i, i + CHUNK));
      }
      console.log(`[unlock-logins] Deleted ${loginKeys.length} Redis key(s).`);
    }

    if (lockedUsers.length > 0) {
      const result = await prisma.user.updateMany({
        where: { id: { in: lockedUsers.map((u) => u.id) } },
        data: { failedLoginAttempts: 0, accountLockedUntil: null },
      });
      console.log(`[unlock-logins] Cleared DB lockout state for ${result.count} user(s).`);
    }

    // Verify: re-scan/re-query and confirm nothing was left behind.
    const remainingKeys = redis ? await scanKeys(redis, "ratelimit:rl:LOGIN:*") : [];
    const remainingLocked = await prisma.user.count({
      where: { OR: [{ accountLockedUntil: { not: null } }, { failedLoginAttempts: { gt: 0 } }] },
    });
    console.log(`\n[unlock-logins] Verification: ${remainingKeys.length} LOGIN key(s) and ${remainingLocked} locked user(s) remain.`);
    if (remainingKeys.length > 0 || remainingLocked > 0) {
      console.log("[unlock-logins] Non-zero remainder is expected if a real login attempt landed between the clear and this check — re-run to confirm it's not stuck.");
    }
  } finally {
    await prisma.$disconnect();
    redis?.disconnect();
  }
}

main().catch((err) => {
  console.error("[unlock-logins] Failed:", err);
  process.exit(1);
});
