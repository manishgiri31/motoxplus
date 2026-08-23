import bcrypt from "bcryptjs";
import { prisma } from "@/lib/prisma";
import { checkRateLimit, peekRateLimit, resetRateLimit } from "./rate-limit";
import { recordFailedLogin, clearFailedLogins, isAccountLocked } from "./rate-limit";
import { RATE_LIMITS } from "./rate-limit-budgets";
import { UNKNOWN_IP } from "./middleware";
import { resolveIdentifier, findUserByIdentifier, type UserWithRelations } from "./identity";

export interface AuthenticateWithPasswordOptions {
  identifierRaw: string;
  password: string;
  ipAddress?: string;
  userAgent?: string;
  deviceInfo?: string;
}

export type CredentialAuthResult =
  | { ok: true; user: UserWithRelations; method: "password-mobile" | "password-email" }
  | { ok: false; code: "RATE_LIMITED" | "INVALID_CREDENTIALS" | "ACCOUNT_DISABLED" | "ACCOUNT_LOCKED"; message: string; retryAfterSeconds?: number };

function formatRetryAfter(seconds: number): string {
  const minutes = Math.ceil(seconds / 60);
  return minutes <= 1 ? "a minute" : `${minutes} minutes`;
}

// The one place password login is actually verified. Previously duplicated
// almost verbatim across /api/auth/login, /api/mobile/auth/login, and
// NextAuth's authorize() — each with its own copy of the lockout/rate-limit/
// audit logic that could (and did) drift out of sync. All three now call
// this and only differ in how they turn a successful result into a session.
export async function authenticateWithPassword(opts: AuthenticateWithPasswordOptions): Promise<CredentialAuthResult> {
  const identifier = resolveIdentifier(opts.identifierRaw);
  const isMobile = identifier.kind === "mobile";
  const method = isMobile ? "password-mobile" as const : "password-email" as const;

  // Same "LOGIN" budget/keyspace regardless of entry point, so an attacker
  // can't dodge the throttle by switching which login endpoint they hit.
  const idKey = `rl:LOGIN:id:${identifier.value}`;
  const hasKnownIP = !!opts.ipAddress && opts.ipAddress !== UNKNOWN_IP;
  const ipKey = hasKnownIP ? `rl:LOGIN:ip:${opts.ipAddress}` : undefined;
  if (opts.ipAddress && !hasKnownIP) {
    // Keying on the literal "unknown" would put every client with no
    // resolvable IP in one shared bucket instead of failing open for them.
    console.warn("[RateLimit] LOGIN: client IP unavailable (no X-Forwarded-For/X-Real-IP) — skipping per-IP check.");
  }

  // Peek, don't increment: a legitimate login (even a slow/typo-prone one
  // that eventually succeeds) shouldn't itself burn down the budget — only
  // an actual failed attempt should (recorded below, after bcrypt runs).
  const peekChecks = [peekRateLimit(idKey, RATE_LIMITS.LOGIN.perIdentifier)];
  if (ipKey) peekChecks.push(peekRateLimit(ipKey, RATE_LIMITS.LOGIN.perIP));
  const peekResults = await Promise.all(peekChecks);
  const blocked = peekResults.find((r) => !r.allowed);
  if (blocked) {
    return {
      ok: false,
      code: "RATE_LIMITED",
      message: `Too many login attempts. Please try again in ${formatRetryAfter(blocked.retryAfterSeconds)}.`,
      retryAfterSeconds: blocked.retryAfterSeconds,
    };
  }

  const user = await findUserByIdentifier(identifier);

  const logFailure = async (userId: string | undefined, reason: string) => {
    if (!userId) return;
    await prisma.loginHistory.create({
      data: { userId, success: false, method, reason, ipAddress: opts.ipAddress, userAgent: opts.userAgent, deviceInfo: opts.deviceInfo },
    }).catch(() => null);
  };

  // Only an actual failed attempt counts against the LOGIN budget — called
  // from every ok:false branch below (unknown identifier, disabled/locked
  // account, wrong password) so probing dead identifiers is throttled same
  // as a wrong password, but a request that turns out to be fine (or that
  // failed for a reason unrelated to the credentials, e.g. a DB hiccup
  // upstream) never does.
  const recordLoginFailure = () => {
    const failures = [checkRateLimit(idKey, RATE_LIMITS.LOGIN.perIdentifier)];
    if (ipKey) failures.push(checkRateLimit(ipKey, RATE_LIMITS.LOGIN.perIP));
    return Promise.all(failures);
  };

  if (!user || !user.password) {
    await recordLoginFailure();
    return { ok: false, code: "INVALID_CREDENTIALS", message: "Invalid email/mobile or password" };
  }

  if (!user.isActive) {
    await recordLoginFailure();
    await logFailure(user.id, "Account disabled");
    return { ok: false, code: "ACCOUNT_DISABLED", message: "Account has been disabled. Contact support." };
  }

  const lockStatus = await isAccountLocked(user.id);
  if (lockStatus.locked) {
    const minutesLeft = lockStatus.until ? Math.ceil((lockStatus.until.getTime() - Date.now()) / 60000) : 30;
    await logFailure(user.id, "Account locked");
    return { ok: false, code: "ACCOUNT_LOCKED", message: `Account locked. Try again in ${minutesLeft} minutes.` };
  }

  const isValid = await bcrypt.compare(opts.password, user.password);
  if (!isValid) {
    const [result] = await Promise.all([recordFailedLogin(user.id), recordLoginFailure(), logFailure(user.id, "Incorrect password")]);
    if (result.locked) {
      return { ok: false, code: "ACCOUNT_LOCKED", message: "Account locked after too many failed attempts. Try again in 30 minutes." };
    }
    return { ok: false, code: "INVALID_CREDENTIALS", message: `Invalid email/mobile or password. ${result.attemptsLeft} attempt(s) remaining.` };
  }

  await Promise.all([clearFailedLogins(user.id), resetRateLimit(idKey), ipKey ? resetRateLimit(ipKey) : Promise.resolve()]);

  await prisma.user.update({
    where: { id: user.id },
    data: { lastLoginIP: opts.ipAddress, lastDevice: opts.deviceInfo },
  });

  await prisma.loginHistory.create({
    data: { userId: user.id, success: true, method, ipAddress: opts.ipAddress, userAgent: opts.userAgent, deviceInfo: opts.deviceInfo },
  }).catch(() => null);

  return { ok: true, user, method };
}
