import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { createOTP, verifyOTP } from "@/lib/auth/otp";
import { createSession } from "@/lib/auth/session";
import { checkIPRateLimit, isAccountLocked } from "@/lib/auth/rate-limit";
import { getClientIP, getDeviceInfo } from "@/lib/auth/middleware";
import { COOKIE_ACCESS, COOKIE_REFRESH, ACCESS_TOKEN_MAX_AGE, REFRESH_TOKEN_MAX_AGE } from "@/lib/auth/jwt";
import { sendOTP } from "@/lib/sms";

// Step 1: Send OTP to mobile
export async function POST(req: NextRequest) {
  const ip = getClientIP(req);
  const { mobile, otp: otpInput } = await req.json();

  if (!mobile) return NextResponse.json({ error: "Mobile number is required" }, { status: 400 });

  const mobileRegex = /^[6-9]\d{9}$/;
  const normalizedMobile = mobile.replace(/\s/g, "").replace("+91", "");
  if (!mobileRegex.test(normalizedMobile)) {
    return NextResponse.json({ error: "Invalid Indian mobile number" }, { status: 400 });
  }

  const user = await prisma.user.findUnique({ where: { mobileNumber: normalizedMobile } });

  // If OTP provided, verify it (step 2)
  if (otpInput) {
    if (!user) return NextResponse.json({ error: "Mobile number not registered" }, { status: 404 });

    if (!user.isActive) return NextResponse.json({ error: "Account disabled" }, { status: 403 });
    const lockStatus = await isAccountLocked(user.id);
    if (lockStatus.locked) return NextResponse.json({ error: "Account locked. Try later." }, { status: 423 });

    const result = await verifyOTP(user.id, "LOGIN", otpInput);
    if (!result.success) return NextResponse.json({ error: result.error }, { status: 400 });

    const { accessToken, refreshToken } = await createSession({
      userId: user.id,
      email: user.email,
      role: user.role,
      ipAddress: ip,
      userAgent: req.headers.get("user-agent") || undefined,
      deviceInfo: getDeviceInfo(req),
    });

    const res = NextResponse.json({
      user: { id: user.id, name: user.name, email: user.email, role: user.role },
    });
    res.cookies.set(COOKIE_ACCESS, accessToken, { httpOnly: true, secure: process.env.NODE_ENV === "production", sameSite: "lax", maxAge: ACCESS_TOKEN_MAX_AGE, path: "/" });
    res.cookies.set(COOKIE_REFRESH, refreshToken, { httpOnly: true, secure: process.env.NODE_ENV === "production", sameSite: "lax", maxAge: REFRESH_TOKEN_MAX_AGE, path: "/" });
    return res;
  }

  // Send OTP step
  if (!checkIPRateLimit(ip, 5, 60)) {
    return NextResponse.json({ error: "Too many requests. Try again in a minute." }, { status: 429 });
  }

  if (!user) return NextResponse.json({ error: "Mobile number not registered" }, { status: 404 });
  if (!user.isActive) return NextResponse.json({ error: "Account disabled" }, { status: 403 });

  const code = await createOTP(user.id, "LOGIN");
  const smsResult = await sendOTP(normalizedMobile, code);
  if (!smsResult.success) {
    return NextResponse.json({ error: "Failed to send OTP. Try again." }, { status: 500 });
  }

  return NextResponse.json({ message: "OTP sent to your mobile number", expires: 10 });
}
