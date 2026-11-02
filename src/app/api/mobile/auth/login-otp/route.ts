import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { verifyOTP } from "@/lib/auth/otp";
import { createSession } from "@/lib/auth/session";
import { isAccountLocked, resetRateLimit } from "@/lib/auth/rate-limit";
import { enforceRateLimit, rejectOversizedBody, JSON_BODY_MAX_BYTES } from "@/lib/auth/rate-limit-budgets";
import { getClientIP, getDeviceInfo, UNKNOWN_IP } from "@/lib/auth/middleware";
import { normalizeIndianMobile } from "@/lib/phone";

const GENERIC_OTP_FAILURE = () => NextResponse.json({ error: "Invalid or expired OTP" }, { status: 400 });

// Mobile counterpart of the verify step in /api/auth/login-otp: same checks and
// same rate-limit budget, but the session comes back as tokens in the body
// (like /api/mobile/auth/login) instead of cookies. The *send* step needs no
// mobile twin — POST /api/auth/login-otp without an `otp` sets no cookies, so
// the app calls it directly.
export async function POST(req: NextRequest) {
  const oversized = rejectOversizedBody(req, JSON_BODY_MAX_BYTES);
  if (oversized) return oversized;

  const { mobile, email, method, otp } = await req.json().catch(() => ({}));
  if (!otp) return NextResponse.json({ error: "OTP is required" }, { status: 400 });

  const isMobileMethod = method === "mobile" || (!method && !!mobile);
  let identifier: string | undefined;
  if (isMobileMethod) {
    identifier = mobile ? normalizeIndianMobile(mobile) ?? undefined : undefined;
    if (!identifier) return NextResponse.json({ error: "Invalid Indian mobile number" }, { status: 400 });
  } else {
    identifier = email ? String(email).trim().toLowerCase() : undefined;
    if (!identifier) return NextResponse.json({ error: "Email address is required" }, { status: 400 });
  }

  const limited = await enforceRateLimit(req, "OTP_VERIFY", identifier);
  if (limited) return limited;

  const user = await prisma.user.findUnique({
    where: isMobileMethod ? { mobileNumber: identifier } : { email: identifier },
    include: { dealer: true },
  });
  // No such user and a wrong/expired code answer identically; account status
  // is only revealed once a correct code has proven the caller owns the number.
  if (!user) return GENERIC_OTP_FAILURE();

  const result = await verifyOTP(user.id, "LOGIN", otp);
  if (!result.success) return GENERIC_OTP_FAILURE();

  if (!user.isActive) return NextResponse.json({ error: "Account disabled" }, { status: 403 });
  const lockStatus = await isAccountLocked(user.id);
  if (lockStatus.locked) return NextResponse.json({ error: "Account locked. Try later." }, { status: 423 });

  const ip = getClientIP(req);
  await Promise.all([
    resetRateLimit(`rl:OTP_VERIFY:id:${identifier}`),
    ip !== UNKNOWN_IP ? resetRateLimit(`rl:OTP_VERIFY:ip:${ip}`) : Promise.resolve(),
  ]);

  const { accessToken, refreshToken } = await createSession({
    userId: user.id,
    email: user.email,
    role: user.role,
    ipAddress: ip,
    userAgent: req.headers.get("user-agent") || undefined,
    deviceInfo: getDeviceInfo(req),
  });

  // Same body as /api/mobile/auth/login — the app parses both with one schema.
  return NextResponse.json({
    accessToken,
    refreshToken,
    user: {
      id: user.id,
      name: user.name,
      email: user.email,
      role: user.role,
      emailVerified: !!user.emailVerified,
      mobileVerified: user.mobileVerified,
      isActive: user.isActive,
    },
    dealer: user.dealer
      ? {
          id: user.dealer.id,
          companyName: user.dealer.companyName,
          ownerName: user.dealer.ownerName,
          phone: user.dealer.phone,
          state: user.dealer.state,
          city: user.dealer.city,
          address: user.dealer.address,
          pincode: user.dealer.pincode,
          gstNumber: user.dealer.gstNumber,
          status: user.dealer.status,
          creditLimit: user.dealer.creditLimit,
        }
      : null,
  });
}
