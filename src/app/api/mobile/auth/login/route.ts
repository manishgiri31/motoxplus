import { NextRequest, NextResponse } from "next/server";
import { authenticateWithPassword } from "@/lib/auth/credentials";
import { createSession } from "@/lib/auth/session";
import { rejectOversizedBody, JSON_BODY_MAX_BYTES } from "@/lib/auth/rate-limit-budgets";
import { getClientIP, getDeviceInfo } from "@/lib/auth/middleware";

const STATUS_BY_CODE = {
  RATE_LIMITED: 429,
  INVALID_CREDENTIALS: 401,
  ACCOUNT_DISABLED: 403,
  ACCOUNT_LOCKED: 423,
} as const;

// Mobile login — returns tokens in the response body instead of cookies.
export async function POST(req: NextRequest) {
  const oversized = rejectOversizedBody(req, JSON_BODY_MAX_BYTES);
  if (oversized) return oversized;

  const { email, mobile, password } = await req.json();
  const identifierRaw = (email || mobile || "").trim();
  if (!identifierRaw || !password) {
    return NextResponse.json({ error: "Email or mobile number, and password are required" }, { status: 400 });
  }

  const ip = getClientIP(req);
  const deviceInfo = getDeviceInfo(req);
  const userAgent = req.headers.get("user-agent") || undefined;

  const result = await authenticateWithPassword({ identifierRaw, password, ipAddress: ip, userAgent, deviceInfo });
  if (!result.ok) {
    const headers = result.retryAfterSeconds ? { "Retry-After": String(Math.ceil(result.retryAfterSeconds)) } : undefined;
    return NextResponse.json(
      { error: result.message, ...(result.retryAfterSeconds ? { retryAfterSeconds: Math.ceil(result.retryAfterSeconds) } : {}) },
      { status: STATUS_BY_CODE[result.code], headers }
    );
  }

  const { user } = result;

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
