import { prisma } from "@/lib/prisma";
import { OtpType } from "@prisma/client";
import crypto from "crypto";

const OTP_LENGTH = 6;
const OTP_EXPIRY_MINUTES = 10;
const MAX_OTP_ATTEMPTS = 3;
const MAX_OTP_RESENDS_PER_HOUR = 5;

export function generateOTP(): string {
  const digits = crypto.randomInt(0, 10 ** OTP_LENGTH);
  return digits.toString().padStart(OTP_LENGTH, "0");
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
    await prisma.otpCode.update({ where: { id: otp.id }, data: { used: true } });
    return { success: false, error: "OTP has expired" };
  }
  if (otp.attempts >= MAX_OTP_ATTEMPTS) {
    await prisma.otpCode.update({ where: { id: otp.id }, data: { used: true } });
    return { success: false, error: "Too many incorrect attempts" };
  }

  if (otp.code !== code) {
    await prisma.otpCode.update({ where: { id: otp.id }, data: { attempts: { increment: 1 } } });
    const remaining = MAX_OTP_ATTEMPTS - otp.attempts - 1;
    return { success: false, error: `Incorrect OTP. ${remaining} attempt(s) remaining` };
  }

  await prisma.otpCode.update({ where: { id: otp.id }, data: { used: true } });
  return { success: true };
}

export async function checkResendLimit(userId: string, type: OtpType): Promise<boolean> {
  const oneHourAgo = new Date(Date.now() - 60 * 60 * 1000);
  const count = await prisma.otpCode.count({
    where: { userId, type, createdAt: { gte: oneHourAgo } },
  });
  return count < MAX_OTP_RESENDS_PER_HOUR;
}
