/**
 * AUDIT ONLY — reset a known password on three seed/admin accounts so the
 * Area-H walk can log in. The scratch DB is a COPY OF PRODUCTION, so the
 * accounts carry production password hashes; seed.ts skipped them (findUnique-
 * guarded) and never set the seed passwords.
 *
 * Safety:
 *   - Target DB URL MUST come from the  AUDIT_DB_URL  env var — no file
 *     fallback. Choosing the target is a deliberate act every run (F-37:
 *     .env / .env.local drift is exactly the failure mode we don't want here).
 *   - Prints the resolved target (password redacted)
 *   - HARD ABORTS unless the database name is exactly  motoxplus_audit
 *   - HARD ABORTS unless the host is localhost / 127.0.0.1
 *   - HARD ABORTS unless the server's own  current_database()  agrees
 *   - DRY RUN by default. Pass  --commit  to actually write.
 *
 * Usage:
 *   AUDIT_DB_URL='postgresql://USER:PASS@localhost:5434/motoxplus_audit' \
 *     node scripts/audit/reset-scratch-passwords.mjs            # dry run + preflight
 *   AUDIT_DB_URL='...' node scripts/audit/reset-scratch-passwords.mjs --commit
 */
import { fileURLToPath } from "node:url";
import { dirname, resolve } from "node:path";
import bcrypt from "bcryptjs";
import { PrismaClient } from "@prisma/client";

const REQUIRED_DB_NAME = "motoxplus_audit";
const ALLOWED_HOSTS = new Set(["localhost", "127.0.0.1", "::1"]);
const TARGET_EMAILS = ["admin@motoxplus.in", "dealer@testshop.in", "superadmin@motoxplus.in"];
const NEW_PASSWORD = "Audit-H-2026-scratch"; // not a production value; documented in AUDIT/01-findings.md §19
const BCRYPT_COST = 12; // matches prisma/seed.ts

const COMMIT = process.argv.includes("--commit");

function redact(u) {
  const x = new URL(u);
  if (x.password) x.password = "***";
  return x.toString();
}

async function main() {
  const rawUrl = process.env.AUDIT_DB_URL;
  if (!rawUrl) {
    console.error(
      "ABORT: AUDIT_DB_URL is not set. This script has no file fallback — the target\n" +
      "must be chosen deliberately every run.\n\n" +
      "  AUDIT_DB_URL='postgresql://USER:PASS@localhost:5434/motoxplus_audit' \\\n" +
      "    node scripts/audit/reset-scratch-passwords.mjs [--commit]\n"
    );
    process.exit(1);
  }
  const resolved = { url: rawUrl, source: "AUDIT_DB_URL env" };

  let url;
  try {
    url = new URL(resolved.url);
  } catch {
    console.error("ABORT: AUDIT_DB_URL is not a valid URL");
    process.exit(1);
  }

  const dbName = decodeURIComponent(url.pathname.replace(/^\//, "").split("?")[0]);

  console.log("─".repeat(64));
  console.log(`  mode          : ${COMMIT ? "COMMIT (will write)" : "DRY RUN (no writes)"}`);
  console.log(`  url source    : ${resolved.source}`);
  console.log(`  resolved url  : ${redact(resolved.url)}`);
  console.log(`  host          : ${url.hostname}`);
  console.log(`  port          : ${url.port || "(default)"}`);
  console.log(`  database name : ${dbName}`);
  console.log("─".repeat(64));

  if (dbName !== REQUIRED_DB_NAME) {
    console.error(`ABORT: database name is "${dbName}", expected exactly "${REQUIRED_DB_NAME}".`);
    process.exit(1);
  }
  if (!ALLOWED_HOSTS.has(url.hostname)) {
    console.error(`ABORT: host "${url.hostname}" is not local. Refusing to touch a non-local database.`);
    process.exit(1);
  }

  const prisma = new PrismaClient({ datasourceUrl: resolved.url });
  try {
    // Extra runtime guard: ask the server its own name and re-check.
    const [{ current_database: liveDb }] = await prisma.$queryRawUnsafe("SELECT current_database()");
    console.log(`  server says current_database() = ${liveDb}`);
    if (liveDb !== REQUIRED_DB_NAME) {
      console.error(`ABORT: server reports "${liveDb}", not "${REQUIRED_DB_NAME}".`);
      process.exit(1);
    }

    // Preflight: role census (helps decide the staff-nav walk) + target state.
    const census = await prisma.user.groupBy({ by: ["role"], _count: { _all: true } });
    console.log("\n  role census:");
    for (const r of census.sort((a, b) => b._count._all - a._count._all)) {
      console.log(`    ${String(r.role).padEnd(14)} ${r._count._all}`);
    }

    const targets = await prisma.user.findMany({
      where: { email: { in: TARGET_EMAILS } },
      select: { email: true, role: true, isActive: true, emailVerifiedAt: true, mobileVerified: true, failedLoginAttempts: true, accountLockedUntil: true },
    });
    console.log("\n  target accounts:");
    for (const email of TARGET_EMAILS) {
      const u = targets.find((t) => t.email === email);
      if (!u) { console.log(`    ${email.padEnd(26)} — NOT FOUND`); continue; }
      console.log(`    ${email.padEnd(26)} role=${u.role} active=${u.isActive} emailVerified=${!!u.emailVerifiedAt} mobileVerified=${u.mobileVerified} failedLogins=${u.failedLoginAttempts} locked=${u.accountLockedUntil ? u.accountLockedUntil.toISOString() : "no"}`);
    }

    const hash = await bcrypt.hash(NEW_PASSWORD, BCRYPT_COST);
    console.log(`\n  new password  : ${NEW_PASSWORD}`);
    console.log(`  bcrypt hash   : ${hash}`);

    if (!COMMIT) {
      console.log("\n  DRY RUN — no rows written. Re-run with --commit to apply.");
      return;
    }

    console.log("\n  applying …");
    for (const email of TARGET_EMAILS) {
      const res = await prisma.user.updateMany({
        where: { email },
        data: { password: hash, failedLoginAttempts: 0, accountLockedUntil: null },
      });
      console.log(`    ${email.padEnd(26)} rows updated: ${res.count}`);
    }
    console.log("\n  done. Passwords reset on the scratch DB only.");
  } finally {
    await prisma.$disconnect();
  }
}

main().catch((e) => { console.error(e); process.exit(1); });
