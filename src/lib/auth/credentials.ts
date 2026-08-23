import bcrypt from "bcryptjs";
import { prisma } from "@/lib/prisma";
import { checkRateLimit } from "./rate-limit";
import { recordFailedLogin, clearFailedLogins, isAccountLocked } from "./rate-limit";
import { RATE_LIMITS } from "./rate-limit-budgets";
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
  | { ok: false; code: "RATE_LIMITED" | "INVALID_CREDENTIALS" | "ACCOUNT_DISABLED" | "ACCOUNT_LOCKED"; message: string };

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
  const rateLimitChecks = [checkRateLimit(`rl:LOGIN:id:${identifier.value}`, RATE_LIMITS.LOGIN.perIdentifier)];
  if (opts.ipAddress) rateLimitChecks.push(checkRateLimit(`rl:LOGIN:ip:${opts.ipAddress}`, RATE_LIMITS.LOGIN.perIP));
  const rateLimitResults = await Promise.all(rateLimitChecks);
  if (rateLimitResults.some((r) => !r.allowed)) {
    return { ok: false, code: "RATE_LIMITED", message: "Too many login attempts. Please try again later." };
  }

  const user = await findUserByIdentifier(identifier);

  const logFailure = async (userId: string | undefined, reason: string) => {
    if (!userId) return;
    await prisma.loginHistory.create({
      data: { userId, success: false, method, reason, ipAddress: opts.ipAddress, userAgent: opts.userAgent, deviceInfo: opts.deviceInfo },
    }).catch(() => null);
  };

  if (!user || !user.password) {
    return { ok: false, code: "INVALID_CREDENTIALS", message: "Invalid email/mobile or password" };
  }

  if (!user.isActive) {
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
    const result = await recordFailedLogin(user.id);
    await logFailure(user.id, "Incorrect password");
    if (result.locked) {
      return { ok: false, code: "ACCOUNT_LOCKED", message: "Account locked after too many failed attempts. Try again in 30 minutes." };
    }
    return { ok: false, code: "INVALID_CREDENTIALS", message: `Invalid email/mobile or password. ${result.attemptsLeft} attempt(s) remaining.` };
  }

  await clearFailedLogins(user.id);

  await prisma.user.update({
    where: { id: user.id },
    data: { lastLoginIP: opts.ipAddress, lastDevice: opts.deviceInfo },
  });

  await prisma.loginHistory.create({
    data: { userId: user.id, success: true, method, ipAddress: opts.ipAddress, userAgent: opts.userAgent, deviceInfo: opts.deviceInfo },
  }).catch(() => null);

  return { ok: true, user, method };
}
