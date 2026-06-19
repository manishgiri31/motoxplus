import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { verifyOTP } from "@/lib/auth/otp";
import crypto from "crypto";

export async function POST(req: NextRequest) {
  const { userId, otp } = await req.json();
  if (!userId || !otp) return NextResponse.json({ error: "User ID and OTP are required" }, { status: 400 });

  const user = await prisma.user.findUnique({ where: { id: userId } });
  if (!user) return NextResponse.json({ error: "Invalid request" }, { status: 400 });

  const result = await verifyOTP(userId, "FORGOT_PASSWORD", otp);
  if (!result.success) return NextResponse.json({ error: result.error }, { status: 400 });

  // Issue a short-lived reset token (10 min)
  const resetToken = crypto.randomBytes(32).toString("hex");
  const resetTokenExpiry = new Date(Date.now() + 10 * 60 * 1000);

  // Clean up any prior reset tokens for this user, then create fresh one
  await prisma.verificationToken.deleteMany({
    where: { identifier: `password-reset:${userId}` },
  });
  await prisma.verificationToken.create({
    data: {
      identifier: `password-reset:${userId}`,
      token: resetToken,
      expires: resetTokenExpiry,
    },
  });

  return NextResponse.json({ resetToken, userId, expires: 10 });
}
