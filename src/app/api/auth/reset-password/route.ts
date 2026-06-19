import { NextRequest, NextResponse } from "next/server";
import bcrypt from "bcryptjs";
import { prisma } from "@/lib/prisma";
import { revokeAllSessions } from "@/lib/auth/session";

export async function POST(req: NextRequest) {
  const { userId, resetToken, newPassword } = await req.json();

  if (!userId || !resetToken || !newPassword) {
    return NextResponse.json({ error: "All fields are required" }, { status: 400 });
  }

  if (newPassword.length < 8) {
    return NextResponse.json({ error: "Password must be at least 8 characters" }, { status: 400 });
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
