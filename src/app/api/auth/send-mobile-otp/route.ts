import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { createOTP, checkResendLimit } from "@/lib/auth/otp";
import { sendOTP } from "@/lib/sms";
import { checkIPRateLimit } from "@/lib/auth/rate-limit";
import { getClientIP, requireAuth } from "@/lib/auth/middleware";

export async function POST(req: NextRequest) {
  const ip = getClientIP(req);
  if (!checkIPRateLimit(ip, 5, 60)) {
    return NextResponse.json({ error: "Too many requests. Try again later." }, { status: 429 });
  }

  const authUser = await requireAuth(req);
  if (!authUser) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const { mobile } = await req.json();
  if (!mobile) return NextResponse.json({ error: "Mobile number is required" }, { status: 400 });

  const mobileRegex = /^[6-9]\d{9}$/;
  const normalizedMobile = mobile.replace(/\s/g, "").replace("+91", "");
  if (!mobileRegex.test(normalizedMobile)) {
    return NextResponse.json({ error: "Invalid Indian mobile number" }, { status: 400 });
  }

  const existingUser = await prisma.user.findUnique({ where: { mobileNumber: normalizedMobile } });
  if (existingUser && existingUser.id !== authUser.userId) {
    return NextResponse.json({ error: "Mobile number already registered to another account" }, { status: 409 });
  }

  // Save mobile number
  await prisma.user.update({ where: { id: authUser.userId }, data: { mobileNumber: normalizedMobile } });

  const canResend = await checkResendLimit(authUser.userId, "MOBILE_VERIFICATION");
  if (!canResend) return NextResponse.json({ error: "Too many OTP requests. Try again in 1 hour." }, { status: 429 });

  const code = await createOTP(authUser.userId, "MOBILE_VERIFICATION");
  const smsResult = await sendOTP(normalizedMobile, code);
  if (!smsResult.success) {
    return NextResponse.json({ error: "Failed to send OTP. Try again." }, { status: 500 });
  }

  return NextResponse.json({ message: "OTP sent to your mobile number", expires: 10 });
}
