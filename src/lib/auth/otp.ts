import { prisma } from "@/lib/prisma";
import { OtpType } from "@prisma/client";
import crypto from "crypto";

const OTP_LENGTH = 6;
export const OTP_EXPIRY_MINUTES = 5;
const MAX_OTP_ATTEMPTS = 5;
const MAX_OTP_RESENDS_PER_HOUR = 10;
const LOCKOUT_COOLDOWN_MINUTES = 15;

export function generateOTP(): string {
  const digits = crypto.randomInt(0, 10 ** OTP_LENGTH);
  return digits.toString().padStart(OTP_LENGTH, "0");
}

// OtpCode.code stores this HMAC, never the 6-digit code itself, so a DB leak
// or backup doesn't hand out live codes. A bare SHA-256 would be useless here
// (only 10^6 possible inputs, trivially brute-forced offline), hence the keyed
// HMAC; binding userId + type stops a hash from one user/purpose being
// replayed against another. JWT_SECRET is reused as the key under a distinct
// "otp:" label, and — like jwt.ts — there is deliberately no fallback secret.
function hashOtp(userId: string, type: OtpType, code: string): string {
  const secret = process.env.JWT_SECRET;
  if (!secret) throw new Error("JWT_SECRET must be set — refusing to hash OTPs with no secret");
  return crypto.createHmac("sha256", secret).update(`otp:${userId}:${type}:${code}`).digest("hex");
}

// Both sides are fixed-length hex digests, so timingSafeEqual never sees a
// length mismatch no matter what the client sent as `provided`.
function otpMatches(row: { userId: string; type: OtpType; code: string }, provided: unknown): boolean {
  if (typeof provided !== "string") return false;
  const a = Buffer.from(row.code);
  const b = Buffer.from(hashOtp(row.userId, row.type, provided));
  if (a.length !== b.length) return false; // legacy plaintext row from before hashing was introduced
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
    data: { userId, type, code: hashOtp(userId, type, code), expiresAt },
  });

  // The plaintext code is returned only so the caller can deliver it.
  return code;
}

/**
 * Checks a code WITHOUT consuming it: a wrong guess still counts against the
 * 5-attempt cap, but a correct one leaves the code live and returns its row id
 * for a later claimOTP(). Lets a flow that needs two codes at once (customer
 * signup: WhatsApp + email) accept both or neither — with verifyOTP, a right
 * phone code next to a mistyped email code would burn the phone code and force
 * the customer to request a new one for no reason.
 */
export async function checkOTP(
  userId: string,
  type: OtpType,
  code: string
): Promise<{ success: true; otpId: string } | { success: false; error: string }> {
  const otp = await prisma.otpCode.findFirst({
    where: { userId, type, used: false },
    orderBy: { createdAt: "desc" },
  });

  if (!otp) return { success: false, error: "Code expired. Request a new one." };
  if (otp.expiresAt < new Date()) {
    await prisma.otpCode.updateMany({ where: { id: otp.id, used: false }, data: { used: true } });
    return { success: false, error: "Code expired. Request a new one." };
  }
  if (otp.attempts >= MAX_OTP_ATTEMPTS) {
    await prisma.otpCode.updateMany({ where: { id: otp.id, used: false }, data: { used: true } });
    return { success: false, error: "Too many incorrect attempts. Request a new code." };
  }
  if (!otpMatches(otp, code)) {
    const updated = await prisma.otpCode.update({ where: { id: otp.id }, data: { attempts: { increment: 1 } } });
    const remaining = Math.max(0, MAX_OTP_ATTEMPTS - updated.attempts);
    return {
      success: false,
      error: remaining > 0 ? `Incorrect code. ${remaining} attempt(s) left.` : "Too many incorrect attempts. Request a new code.",
    };
  }
  return { success: true, otpId: otp.id };
}

/** Marks a code returned by checkOTP() as used. False if a concurrent request already claimed it. */
export async function claimOTP(otpId: string): Promise<boolean> {
  const claimed = await prisma.otpCode.updateMany({ where: { id: otpId, used: false }, data: { used: true } });
  return claimed.count === 1;
}

export async function verifyOTP(
  userId: string,
  type: OtpType,
  code: string
): Promise<{ success: boolean; error?: string }> {
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

  if (!otpMatches(otp, code)) {
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

export async function checkResendLimit(
  userId: string,
  type: OtpType,
  maxPerHour: number = MAX_OTP_RESENDS_PER_HOUR
): Promise<boolean> {
  if (await isOtpLocked(userId, type)) return false;

  const oneHourAgo = new Date(Date.now() - 60 * 60 * 1000);
  const count = await prisma.otpCode.count({
    where: { userId, type, createdAt: { gte: oneHourAgo } },
  });
  return count < maxPerHour;
}
