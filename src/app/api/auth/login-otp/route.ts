import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { createOTP, verifyOTP, checkResendLimit, OTP_EXPIRY_MINUTES } from "@/lib/auth/otp";
import { createSession } from "@/lib/auth/session";
import { isAccountLocked } from "@/lib/auth/rate-limit";
import { enforceRateLimit, rejectOversizedBody, JSON_BODY_MAX_BYTES } from "@/lib/auth/rate-limit-budgets";
import { getClientIP, getDeviceInfo } from "@/lib/auth/middleware";
import { COOKIE_ACCESS, COOKIE_REFRESH, ACCESS_TOKEN_MAX_AGE, REFRESH_TOKEN_MAX_AGE } from "@/lib/auth/jwt";
import { sendOTP } from "@/lib/sms";
import { normalizeIndianMobile } from "@/lib/phone";

// Same message/shape whether or not `mobile` is registered — this used to
// 404 "Mobile number not registered" from both branches below, letting
// anyone enumerate registered dealer/vendor phone numbers one guess at a
// time with no OTP needed. Matches the pattern in forgot-password.ts.
const GENERIC_SENT = { message: "If this mobile number is registered, an OTP has been sent.", expires: OTP_EXPIRY_MINUTES };
const GENERIC_OTP_FAILURE = () => NextResponse.json({ error: "Invalid or expired OTP" }, { status: 400 });

// Step 1: Send OTP to mobile
export async function POST(req: NextRequest) {
  const oversized = rejectOversizedBody(req, JSON_BODY_MAX_BYTES);
  if (oversized) return oversized;

  const { mobile, otp: otpInput } = await req.json();

  if (!mobile) return NextResponse.json({ error: "Mobile number is required" }, { status: 400 });

  const normalizedMobile = normalizeIndianMobile(mobile);
  if (!normalizedMobile) {
    return NextResponse.json({ error: "Invalid Indian mobile number" }, { status: 400 });
  }

  // If OTP provided, verify it (step 2)
  if (otpInput) {
    const limited = await enforceRateLimit(req, "OTP_VERIFY", normalizedMobile);
    if (limited) return limited;

    const user = await prisma.user.findUnique({ where: { mobileNumber: normalizedMobile } });
    // Every failure path down here — no such user, disabled account, locked
    // account, wrong/expired code — returns the exact same response. Account
    // status/lock detail is only revealed once a *correct* OTP has already
    // proven the caller actually owns this phone number.
    if (!user) return GENERIC_OTP_FAILURE();

    const result = await verifyOTP(user.id, "LOGIN", otpInput);
    if (!result.success) return GENERIC_OTP_FAILURE();

    if (!user.isActive) return NextResponse.json({ error: "Account disabled" }, { status: 403 });
    const lockStatus = await isAccountLocked(user.id);
    if (lockStatus.locked) return NextResponse.json({ error: "Account locked. Try later." }, { status: 423 });

    const { accessToken, refreshToken } = await createSession({
      userId: user.id,
      email: user.email,
      role: user.role,
      ipAddress: getClientIP(req),
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

  // Send OTP step — per-IP AND per-phone, strictest budget class (real
  // WhatsApp/SMS send cost).
  const limited = await enforceRateLimit(req, "OTP_SEND", normalizedMobile);
  if (limited) return limited;

  const user = await prisma.user.findUnique({ where: { mobileNumber: normalizedMobile } });
  if (!user || !user.isActive) {
    return NextResponse.json(GENERIC_SENT);
  }

  // Per-account resend cap (5/hour) layered on top of the per-phone/per-IP
  // budget above.
  const canResend = await checkResendLimit(user.id, "LOGIN");
  if (!canResend) {
    return NextResponse.json({ error: "Too many OTP requests. Try again in 1 hour." }, { status: 429 });
  }

  const code = await createOTP(user.id, "LOGIN");
  const smsResult = await sendOTP(normalizedMobile, code);
  if (!smsResult.success) {
    return NextResponse.json({ error: "Failed to send OTP. Try again." }, { status: 500 });
  }

  return NextResponse.json(GENERIC_SENT);
}
