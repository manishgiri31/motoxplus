import { NextRequest, NextResponse } from "next/server";
import bcrypt from "bcryptjs";
import { prisma } from "@/lib/prisma";
import { createSession } from "@/lib/auth/session";
import {
  recordFailedLogin,
  clearFailedLogins,
  isAccountLocked,
  checkIPRateLimit,
} from "@/lib/auth/rate-limit";
import { getClientIP, getDeviceInfo } from "@/lib/auth/middleware";

// Mobile login — returns tokens in the response body instead of cookies.
export async function POST(req: NextRequest) {
  const ip = getClientIP(req);
  if (!checkIPRateLimit(ip, 10, 60)) {
    return NextResponse.json(
      { error: "Too many login attempts. Try again in a minute." },
      { status: 429 }
    );
  }

  const { email, mobile, password } = await req.json();
  const identifier = (email || mobile || "").trim();
  if (!identifier || !password) {
    return NextResponse.json(
      { error: "Email or mobile number, and password are required" },
      { status: 400 }
    );
  }

  const normalizedMobile = identifier.replace(/\s/g, "").replace("+91", "");
  const isMobile = /^[6-9]\d{9}$/.test(normalizedMobile);

  const user = await prisma.user.findUnique({
    where: isMobile ? { mobileNumber: normalizedMobile } : { email: identifier.toLowerCase() },
    include: { dealer: true },
  });

  const deviceInfo = getDeviceInfo(req);
  const userAgent = req.headers.get("user-agent") || undefined;
  const logFailure = async (userId: string | undefined, reason: string) => {
    if (!userId) return;
    await prisma.loginHistory.create({
      data: { userId, success: false, method: isMobile ? "password-mobile" : "password-email", reason, ipAddress: ip, userAgent, deviceInfo },
    }).catch(() => null);
  };

  if (!user || !user.password) {
    return NextResponse.json(
      { error: "Invalid email/mobile or password" },
      { status: 401 }
    );
  }

  if (!user.isActive) {
    await logFailure(user.id, "Account disabled");
    return NextResponse.json(
      { error: "Account has been disabled. Contact support." },
      { status: 403 }
    );
  }

  const lockStatus = await isAccountLocked(user.id);
  if (lockStatus.locked) {
    const minutesLeft = lockStatus.until
      ? Math.ceil((lockStatus.until.getTime() - Date.now()) / 60000)
      : 30;
    await logFailure(user.id, "Account locked");
    return NextResponse.json(
      { error: `Account locked. Try again in ${minutesLeft} minutes.` },
      { status: 423 }
    );
  }

  const isValid = await bcrypt.compare(password, user.password);
  if (!isValid) {
    const result = await recordFailedLogin(user.id);
    await logFailure(user.id, "Incorrect password");
    if (result.locked) {
      return NextResponse.json(
        { error: "Account locked after too many failed attempts. Try again in 30 minutes." },
        { status: 423 }
      );
    }
    return NextResponse.json(
      { error: `Invalid email/mobile or password. ${result.attemptsLeft} attempt(s) remaining.` },
      { status: 401 }
    );
  }

  await clearFailedLogins(user.id);

  await prisma.user.update({
    where: { id: user.id },
    data: { lastLoginIP: ip, lastDevice: deviceInfo },
  });

  await prisma.loginHistory.create({
    data: { userId: user.id, success: true, method: isMobile ? "password-mobile" : "password-email", ipAddress: ip, userAgent, deviceInfo },
  }).catch(() => null);

  // Verification/approval gating is left to the client: emailVerified,
  // mobileVerified and dealer.status are returned so the app can route to
  // the appropriate screen instead of the request being hard-blocked here.
  const { accessToken, refreshToken } = await createSession({
    userId: user.id,
    email: user.email,
    role: user.role,
    ipAddress: ip,
    userAgent,
    deviceInfo,
  });

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
