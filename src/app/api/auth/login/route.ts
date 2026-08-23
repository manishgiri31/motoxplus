import { NextRequest, NextResponse } from "next/server";
import { authenticateWithPassword } from "@/lib/auth/credentials";
import { establishWebSession, setWebSessionCookies } from "@/lib/auth/web-session";
import { rejectOversizedBody, JSON_BODY_MAX_BYTES } from "@/lib/auth/rate-limit-budgets";
import { getClientIP, getDeviceInfo } from "@/lib/auth/middleware";

const STATUS_BY_CODE = {
  RATE_LIMITED: 429,
  INVALID_CREDENTIALS: 401,
  ACCOUNT_DISABLED: 403,
  ACCOUNT_LOCKED: 423,
} as const;

export async function POST(req: NextRequest) {
  const oversized = rejectOversizedBody(req, JSON_BODY_MAX_BYTES);
  if (oversized) return oversized;

  const { email, mobile, password } = await req.json();
  const identifierRaw = (email || mobile || "").trim();
  if (!identifierRaw || !password) {
    return NextResponse.json({ error: "Email or mobile number, and password are required" }, { status: 400 });
  }

  const ip = getClientIP(req);
  const result = await authenticateWithPassword({
    identifierRaw,
    password,
    ipAddress: ip,
    userAgent: req.headers.get("user-agent") || undefined,
    deviceInfo: getDeviceInfo(req),
  });

  if (!result.ok) {
    return NextResponse.json({ error: result.message }, { status: STATUS_BY_CODE[result.code] });
  }

  const { user } = result;

  // Email/mobile verification and dealer/vendor approval are surfaced to the
  // caller via the response flags rather than blocking login outright.
  const session = await establishWebSession(user, { ipAddress: ip, userAgent: req.headers.get("user-agent") || undefined, deviceInfo: getDeviceInfo(req) });

  const res = NextResponse.json({
    user: {
      id: user.id,
      name: user.name,
      email: user.email,
      role: user.role,
      emailVerified: !!user.emailVerified,
      mobileVerified: user.mobileVerified,
      dealerStatus: user.dealer?.status ?? null,
      vendorStatus: user.vendor?.status ?? null,
    },
  });

  setWebSessionCookies(res, session);
  return res;
}
