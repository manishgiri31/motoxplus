import { NextRequest, NextResponse } from "next/server";
import { rotateSession } from "@/lib/auth/session";

// Mobile token refresh — accepts refreshToken in body, returns new tokens in body.
export async function POST(req: NextRequest) {
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
