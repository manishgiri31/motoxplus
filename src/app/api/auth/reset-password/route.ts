import { NextRequest, NextResponse } from "next/server";
import bcrypt from "bcryptjs";
import { prisma } from "@/lib/prisma";
import { revokeAllSessions } from "@/lib/auth/session";
import { validateNewPassword } from "@/lib/auth/password-policy";
import { enforceRateLimit, rejectOversizedBody, JSON_BODY_MAX_BYTES } from "@/lib/auth/rate-limit-budgets";

export async function POST(req: NextRequest) {
  const oversized = rejectOversizedBody(req, JSON_BODY_MAX_BYTES);
  if (oversized) return oversized;

  const { userId, resetToken, newPassword } = await req.json();

  if (!userId || !resetToken || !newPassword) {
    return NextResponse.json({ error: "All fields are required" }, { status: 400 });
  }

  const limited = await enforceRateLimit(req, "PASSWORD_RESET", userId);
  if (limited) return limited;

  const passwordError = validateNewPassword(newPassword);
  if (passwordError) {
    return NextResponse.json({ error: passwordError }, { status: 400 });
  }

  const tokenRecord = await prisma.verificationToken.findFirst({
    where: {
      identifier: `password-reset:${userId}`,
      token: resetToken,
      expires: { gt: new Date() },
    },
  });

  if (!tokenRecord) {
    return NextResponse.json({ error: "Invalid or expired reset token" }, { status: 400 });
  }

  const hashed = await bcrypt.hash(newPassword, 12);

  await prisma.user.update({
    where: { id: userId },
    data: { password: hashed, failedLoginAttempts: 0, accountLockedUntil: null },
  });

  // Invalidate the reset token
  await prisma.verificationToken.delete({
    where: { identifier_token: { identifier: `password-reset:${userId}`, token: resetToken } },
  }).catch(() => null);

  // Revoke all active sessions for security
  await revokeAllSessions(userId);

  return NextResponse.json({ message: "Password reset successfully. Please log in with your new password." });
}
