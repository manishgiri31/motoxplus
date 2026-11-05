import { NextRequest, NextResponse } from "next/server";
import { rotateSession } from "@/lib/auth/session";
import { enforceRateLimit, rejectOversizedBody, JSON_BODY_MAX_BYTES } from "@/lib/auth/rate-limit-budgets";

// Mobile token refresh — accepts refreshToken in body, returns new tokens in body.
export async function POST(req: NextRequest) {
  const limited = await enforceRateLimit(req, "PUBLIC_API");
  if (limited) return limited;
  const oversized = rejectOversizedBody(req, JSON_BODY_MAX_BYTES);
  if (oversized) return oversized;

  const { refreshToken } = await req.json();
  if (!refreshToken) {
    return NextResponse.json({ error: "refreshToken is required" }, { status: 400 });
  }

  try {
    const result = await rotateSession(refreshToken, req.headers.get("x-forwarded-for") || "");
    if (!result) return NextResponse.json({ error: "Invalid or expired refresh token" }, { status: 401 });
    return NextResponse.json({
      accessToken: result.accessToken,
      refreshToken: result.refreshToken,
    });
  } catch {
    return NextResponse.json({ error: "Invalid or expired refresh token" }, { status: 401 });
  }
}
