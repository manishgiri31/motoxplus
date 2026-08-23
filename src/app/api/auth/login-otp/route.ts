import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { createOTP, verifyOTP, checkResendLimit, OTP_EXPIRY_MINUTES } from "@/lib/auth/otp";
import { createSession } from "@/lib/auth/session";
import { isAccountLocked } from "@/lib/auth/rate-limit";
import { enforceRateLimit, rejectOversizedBody, JSON_BODY_MAX_BYTES } from "@/lib/auth/rate-limit-budgets";
import { getClientIP, getDeviceInfo } from "@/lib/auth/middleware";
import { COOKIE_ACCESS, COOKIE_REFRESH, ACCESS_TOKEN_MAX_AGE, REFRESH_TOKEN_MAX_AGE } from "@/lib/auth/jwt";
import { sendOTP } from "@/lib/sms";
import { sendEmail, loginOtpTemplate } from "@/lib/email";
import { normalizeIndianMobile } from "@/lib/phone";

// Same message/shape whether or not the identifier is registered — this used
// to 404 "Mobile number not registered" from both branches below, letting
// anyone enumerate registered dealer/vendor phone numbers or emails one
// guess at a time with no OTP needed. Matches the pattern in forgot-password.ts.
const GENERIC_SENT = { message: "If this account is registered, an OTP has been sent.", expires: OTP_EXPIRY_MINUTES };
const GENERIC_OTP_FAILURE = () => NextResponse.json({ error: "Invalid or expired OTP" }, { status: 400 });

// Step 1: Send OTP to mobile or email. Step 2 (otp present): verify it.
export async function POST(req: NextRequest) {
  const oversized = rejectOversizedBody(req, JSON_BODY_MAX_BYTES);
  if (oversized) return oversized;

  const { mobile, email, method, otp: otpInput } = await req.json();

  const isMobileMethod = method === "mobile" || (!method && !!mobile);
  let identifier: string | undefined;
  if (isMobileMethod) {
    identifier = mobile ? normalizeIndianMobile(mobile) ?? undefined : undefined;
    if (!identifier) return NextResponse.json({ error: "Invalid Indian mobile number" }, { status: 400 });
  } else {
    identifier = email ? String(email).trim().toLowerCase() : undefined;
    if (!identifier) return NextResponse.json({ error: "Email address is required" }, { status: 400 });
  }

  const findUser = () =>
    prisma.user.findUnique({ where: isMobileMethod ? { mobileNumber: identifier } : { email: identifier } });

  // If OTP provided, verify it (step 2)
  if (otpInput) {
    const limited = await enforceRateLimit(req, "OTP_VERIFY", identifier);
    if (limited) return limited;

    const user = await findUser();
    // Every failure path down here — no such user, disabled account, locked
    // account, wrong/expired code — returns the exact same response. Account
    // status/lock detail is only revealed once a *correct* OTP has already
    // proven the caller actually owns this phone number/email.
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

  // Send OTP step. SMS/WhatsApp has a real per-send cost and stays on the
  // strict OTP_SEND budget; email has no send cost so uses the uncapped
  // (IP-guarded only) OTP_SEND_EMAIL budget — same split as forgot-password.
  const limited = await enforceRateLimit(req, isMobileMethod ? "OTP_SEND" : "OTP_SEND_EMAIL", identifier);
  if (limited) return limited;

  const user = await findUser();
  if (!user || !user.isActive) {
    return NextResponse.json(GENERIC_SENT);
  }

  // Per-account resend cap layered on top of the per-identifier/per-IP budget
  // above — skipped for email since there's no cost to cap.
  const canResend = await checkResendLimit(user.id, "LOGIN", isMobileMethod ? undefined : Infinity);
  if (!canResend) {
    return NextResponse.json({ error: "Too many OTP requests. Try again in 1 hour." }, { status: 429 });
  }

  const code = await createOTP(user.id, "LOGIN");

  if (isMobileMethod) {
    const smsResult = await sendOTP(identifier!, code);
    if (!smsResult.success) {
      return NextResponse.json({ error: "Failed to send OTP. Try again." }, { status: 500 });
    }
  } else {
    await sendEmail({
      to: user.email,
      subject: "Login OTP — MOTOXPLUS",
      html: loginOtpTemplate(user.name || "", code),
    }).catch(console.error);
  }

  return NextResponse.json(GENERIC_SENT);
}
