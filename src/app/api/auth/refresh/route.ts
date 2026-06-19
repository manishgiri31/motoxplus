import { NextRequest, NextResponse } from "next/server";
import { rotateSession } from "@/lib/auth/session";
import { COOKIE_ACCESS, COOKIE_REFRESH, ACCESS_TOKEN_MAX_AGE, REFRESH_TOKEN_MAX_AGE } from "@/lib/auth/jwt";
import { getClientIP } from "@/lib/auth/middleware";

export async function POST(req: NextRequest) {
  const refreshToken = req.cookies.get(COOKIE_REFRESH)?.value;
  if (!refreshToken) return NextResponse.json({ error: "No refresh token" }, { status: 401 });

  const ip = getClientIP(req);
  const tokens = await rotateSession(refreshToken, ip);

  if (!tokens) {
    const res = NextResponse.json({ error: "Invalid or expired refresh token" }, { status: 401 });
    res.cookies.delete(COOKIE_ACCESS);
    res.cookies.delete(COOKIE_REFRESH);
    return res;
  }

  const res = NextResponse.json({ message: "Tokens refreshed" });
  res.cookies.set(COOKIE_ACCESS, tokens.accessToken, {
    httpOnly: true,
    secure: process.env.NODE_ENV === "production",
    sameSite: "lax",
    maxAge: ACCESS_TOKEN_MAX_AGE,
    path: "/",
  });
  res.cookies.set(COOKIE_REFRESH, tokens.refreshToken, {
    httpOnly: true,
    secure: process.env.NODE_ENV === "production",
    sameSite: "lax",
    maxAge: REFRESH_TOKEN_MAX_AGE,
    path: "/",
  });
  return res;
}
