import { NextRequest, NextResponse } from "next/server";
import bcrypt from "bcryptjs";
import { prisma } from "@/lib/prisma";
import { createSession } from "@/lib/auth/session";
import { recordFailedLogin, clearFailedLogins, isAccountLocked, checkIPRateLimit } from "@/lib/auth/rate-limit";
import { getClientIP, getDeviceInfo } from "@/lib/auth/middleware";
import { COOKIE_ACCESS, COOKIE_REFRESH, ACCESS_TOKEN_MAX_AGE, REFRESH_TOKEN_MAX_AGE } from "@/lib/auth/jwt";

export async function POST(req: NextRequest) {
  const ip = getClientIP(req);
  if (!checkIPRateLimit(ip, 10, 60)) {
    return NextResponse.json({ error: "Too many login attempts. Try again in a minute." }, { status: 429 });
  }

  const { email, password } = await req.json();
  if (!email || !password) {
    return NextResponse.json({ error: "Email and password are required" }, { status: 400 });
  }

  const user = await prisma.user.findUnique({
    where: { email: email.toLowerCase() },
    include: { dealer: true, admin: true, vendor: true },
  });

  if (!user || !user.password) {
    return NextResponse.json({ error: "Invalid email or password" }, { status: 401 });
  }

  if (!user.isActive) {
    return NextResponse.json({ error: "Account has been disabled. Contact support." }, { status: 403 });
  }

  const lockStatus = await isAccountLocked(user.id);
  if (lockStatus.locked) {
    const minutesLeft = lockStatus.until
      ? Math.ceil((lockStatus.until.getTime() - Date.now()) / 60000)
      : 30;
    return NextResponse.json({ error: `Account locked. Try again in ${minutesLeft} minutes.` }, { status: 423 });
  }

  const isValid = await bcrypt.compare(password, user.password);
  if (!isValid) {
    const result = await recordFailedLogin(user.id);
    if (result.locked) {
      return NextResponse.json({ error: "Account locked after too many failed attempts. Try again in 30 minutes." }, { status: 423 });
    }
    return NextResponse.json({ error: `Invalid email or password. ${result.attemptsLeft} attempt(s) remaining.` }, { status: 401 });
  }

  // Dealer status checks
  if (user.role === "DEALER" && user.dealer?.status !== "APPROVED") {
    const msgs: Record<string, string> = {
      PENDING: "Your dealer account is pending approval.",
      REJECTED: "Your dealer application has been rejected.",
      SUSPENDED: "Your dealer account has been suspended.",
    };
    return NextResponse.json({ error: msgs[user.dealer?.status || ""] || "Account not approved." }, { status: 403 });
  }

  await clearFailedLogins(user.id);

  const { accessToken, refreshToken } = await createSession({
    userId: user.id,
    email: user.email,
    role: user.role,
    ipAddress: ip,
    userAgent: req.headers.get("user-agent") || undefined,
    deviceInfo: getDeviceInfo(req),
  });

  const res = NextResponse.json({
    user: {
      id: user.id,
      name: user.name,
      email: user.email,
      role: user.role,
      emailVerified: !!user.emailVerified,
      mobileVerified: user.mobileVerified,
    },
  });

  res.cookies.set(COOKIE_ACCESS, accessToken, {
    httpOnly: true,
    secure: process.env.NODE_ENV === "production",
    sameSite: "lax",
    maxAge: ACCESS_TOKEN_MAX_AGE,
    path: "/",
  });
  res.cookies.set(COOKIE_REFRESH, refreshToken, {
    httpOnly: true,
    secure: process.env.NODE_ENV === "production",
    sameSite: "lax",
    maxAge: REFRESH_TOKEN_MAX_AGE,
    path: "/",
  });

  return res;
}
