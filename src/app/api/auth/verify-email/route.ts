import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { verifyOTP } from "@/lib/auth/otp";

export async function POST(req: NextRequest) {
  const { userId, otp } = await req.json();

  if (!userId || !otp) {
    return NextResponse.json({ error: "User ID and OTP are required" }, { status: 400 });
  }

  const user = await prisma.user.findUnique({ where: { id: userId } });
  if (!user) return NextResponse.json({ error: "User not found" }, { status: 404 });
  if (user.emailVerified) return NextResponse.json({ error: "Email already verified" }, { status: 400 });

  const result = await verifyOTP(userId, "EMAIL_VERIFICATION", otp);
  if (!result.success) return NextResponse.json({ error: result.error }, { status: 400 });

  const now = new Date();
  await prisma.user.update({
    where: { id: userId },
    data: { emailVerified: now, emailVerifiedAt: now },
  });

  return NextResponse.json({ message: "Email verified successfully" });
}
