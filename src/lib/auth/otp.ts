import { prisma } from "@/lib/prisma";
import { OtpType } from "@prisma/client";
import crypto from "crypto";

const OTP_LENGTH = 6;
export const OTP_EXPIRY_MINUTES = 5;
const MAX_OTP_ATTEMPTS = 5;
const MAX_OTP_RESENDS_PER_HOUR = 5;
const LOCKOUT_COOLDOWN_MINUTES = 15;

export function generateOTP(): string {
  const digits = crypto.randomInt(0, 10 ** OTP_LENGTH);
  return digits.toString().padStart(OTP_LENGTH, "0");
}

// Fixed-length codes (generateOTP always pads to OTP_LENGTH), but `provided`
// comes straight from the client and can be any length/content — compare
// lengths first (timingSafeEqual throws on a mismatch rather than returning
// false) and only timing-safe-compare once both sides are equal length, so a
// guesser can't use response timing to learn how many leading digits matched.
function otpMatches(expected: string, provided: unknown): boolean {
  if (typeof provided !== "string") return false;
  const a = Buffer.from(expected);
  const b = Buffer.from(provided);
  if (a.length !== b.length) return false;
  return crypto.timingSafeEqual(a, b);
}

// No dedicated lockout column on OtpCode — derived instead from the most
// recent maxed-out code's createdAt, so this needs no migration. A verify
// call against a maxed-out code already fails (createOTP burns it, and
// verifyOTP only looks at used:false rows); this is what stops a *new* code
// being issued (and therefore a fresh set of attempts) during the cooldown.
async function isOtpLocked(userId: string, type: OtpType): Promise<boolean> {
  const maxedOut = await prisma.otpCode.findFirst({
    where: { userId, type, attempts: { gte: MAX_OTP_ATTEMPTS } },
    orderBy: { createdAt: "desc" },
    select: { createdAt: true },
  });
  if (!maxedOut) return false;
  const cooldownEnds = new Date(maxedOut.createdAt.getTime() + LOCKOUT_COOLDOWN_MINUTES * 60 * 1000);
  return cooldownEnds > new Date();
}

export async function createOTP(userId: string, type: OtpType): Promise<string> {
  // Invalidate all previous OTPs of this type for user
  await prisma.otpCode.updateMany({
    where: { userId, type, used: false },
    data: { used: true },
  });

  const code = generateOTP();
  const expiresAt = new Date(Date.now() + OTP_EXPIRY_MINUTES * 60 * 1000);

  await prisma.otpCode.create({
    data: { userId, type, code, expiresAt },
  });

  return code;
}

// Local-dev convenience: lets a developer skip actually receiving the OTP
// (WhatsApp/SMS/email) by entering this fixed code instead, so repeated
// local testing doesn't require a live message every time. Still requires a
// real pending OTP to exist (i.e. "Send OTP" was actually called) and burns
// it the same way a real success does — it's a shortcut past *delivery*,
// not past the request flow. Gated strictly on NODE_ENV === "development":
// never "test" (vitest sets NODE_ENV=test, and otp.test.ts deliberately
// reuses "000000" as a guaranteed-wrong guess) and structurally impossible
// in any deployed environment, since Next.js always sets NODE_ENV=production there.
const DEV_BYPASS_CODE = "000000";

export async function verifyOTP(
  userId: string,
  type: OtpType,
  code: string
): Promise<{ success: boolean; error?: string }> {
  if (process.env.NODE_ENV === "development" && code === DEV_BYPASS_CODE) {
    const pending = await prisma.otpCode.findFirst({
      where: { userId, type, used: false },
      orderBy: { createdAt: "desc" },
    });
    if (!pending) return { success: false, error: "Invalid or expired OTP" };
    await prisma.otpCode.updateMany({ where: { id: pending.id, used: false }, data: { used: true } });
    return { success: true };
  }

  const otp = await prisma.otpCode.findFirst({
    where: { userId, type, used: false },
    orderBy: { createdAt: "desc" },
  });

  if (!otp) return { success: false, error: "Invalid or expired OTP" };
  if (otp.expiresAt < new Date()) {
    await prisma.otpCode.updateMany({ where: { id: otp.id, used: false }, data: { used: true } });
    return { success: false, error: "OTP has expired" };
  }
  if (otp.attempts >= MAX_OTP_ATTEMPTS) {
    await prisma.otpCode.updateMany({ where: { id: otp.id, used: false }, data: { used: true } });
    return { success: false, error: "Too many incorrect attempts" };
  }

  if (!otpMatches(otp.code, code)) {
    const updated = await prisma.otpCode.update({ where: { id: otp.id }, data: { attempts: { increment: 1 } } });
    const remaining = Math.max(0, MAX_OTP_ATTEMPTS - updated.attempts);
    return {
      success: false,
      error: remaining > 0 ? `Incorrect OTP. ${remaining} attempt(s) remaining` : "Too many incorrect attempts",
    };
  }

  // Guarded on used:false so this only "succeeds" for whichever concurrent
  // call actually wins the race to flip the flag — a second verify call
  // (double-submit, retried request) against the same already-claimed code
  // gets count:0 and fails closed instead of both calls reporting success.
  const claimed = await prisma.otpCode.updateMany({ where: { id: otp.id, used: false }, data: { used: true } });
  if (claimed.count === 0) return { success: false, error: "Invalid or expired OTP" };
  return { success: true };
}

export async function checkResendLimit(userId: string, type: OtpType): Promise<boolean> {
  if (await isOtpLocked(userId, type)) return false;

  const oneHourAgo = new Date(Date.now() - 60 * 60 * 1000);
  const count = await prisma.otpCode.count({
    where: { userId, type, createdAt: { gte: oneHourAgo } },
  });
  return count < MAX_OTP_RESENDS_PER_HOUR;
}
