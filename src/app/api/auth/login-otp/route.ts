import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { createOTP, verifyOTP, checkResendLimit, OTP_EXPIRY_MINUTES } from "@/lib/auth/otp";
import { establishWebSession, setWebSessionCookies } from "@/lib/auth/web-session";
import { deliverOtp } from "@/lib/auth/otp-delivery";
import { isAccountLocked, resetRateLimit } from "@/lib/auth/rate-limit";
import { enforceRateLimit, rejectOversizedBody, JSON_BODY_MAX_BYTES } from "@/lib/auth/rate-limit-budgets";
import { getClientIP, getDeviceInfo, UNKNOWN_IP } from "@/lib/auth/middleware";
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
    prisma.user.findUnique({
      where: isMobileMethod ? { mobileNumber: identifier } : { email: identifier },
      include: { dealer: true, vendor: true, admin: true },
    });

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

    // Clear the OTP_VERIFY abuse counter for this identifier/IP on a
    // successful login — same "reset on success" contract as the password
    // path, so a string of ordinary logins doesn't erode the budget.
    const verifyIp = getClientIP(req);
    await Promise.all([
      resetRateLimit(`rl:OTP_VERIFY:id:${identifier}`),
      verifyIp !== UNKNOWN_IP ? resetRateLimit(`rl:OTP_VERIFY:ip:${verifyIp}`) : Promise.resolve(),
    ]);

    const session = await establishWebSession(user, {
      ipAddress: getClientIP(req),
      userAgent: req.headers.get("user-agent") || undefined,
      deviceInfo: getDeviceInfo(req),
    });

    const res = NextResponse.json({
      user: { id: user.id, name: user.name, email: user.email, role: user.role },
    });
    setWebSessionCookies(res, session);
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
    const result = await deliverOtp({ channel: "WHATSAPP", destination: identifier!, code, purpose: "LOGIN", name: user.name ?? undefined });
    if (!result.delivered) {
      return NextResponse.json({ error: result.error }, { status: 500 });
    }
  } else {
    // Email has no send cost, so a delivery failure here is logged but not
    // surfaced — an already rate-limited caller shouldn't be blocked by a
    // transient Resend hiccup when the OTP itself was created successfully.
    deliverOtp({ channel: "EMAIL", destination: user.email, code, purpose: "LOGIN", name: user.name ?? undefined })
      .then((result) => { if (!result.delivered) console.error("[LoginOTP]", result.error); })
      .catch(console.error);
  }

  return NextResponse.json(GENERIC_SENT);
}
