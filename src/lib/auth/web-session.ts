import { NextResponse } from "next/server";
import { encode } from "next-auth/jwt";
import { createSession } from "./session";
import { buildSessionClaims, type UserWithRelations } from "./identity";
import { COOKIE_ACCESS, COOKIE_REFRESH, ACCESS_TOKEN_MAX_AGE, REFRESH_TOKEN_MAX_AGE } from "./jwt";

// Mirrors authOptions.session.maxAge in src/lib/auth.ts — kept in sync
// manually since importing authOptions here would pull NextAuth's Prisma
// adapter into every route that establishes a session.
const NEXTAUTH_SESSION_MAX_AGE = process.env.NODE_ENV === "production" ? 8 * 60 * 60 : 30 * 24 * 60 * 60;
const NEXTAUTH_COOKIE_NAME = process.env.NODE_ENV === "production" ? "__Secure-next-auth.session-token" : "next-auth.session-token";

interface EstablishWebSessionOptions {
  ipAddress?: string;
  userAgent?: string;
  deviceInfo?: string;
}

// The single place a browser-facing login (password via REST, email OTP,
// WhatsApp OTP) turns a verified user into an authenticated session. Calls
// the canonical createSession() (UserSession row + mx_access/mx_refresh) —
// the same session-creation path mobile login uses — and additionally mints
// a NextAuth-compatible session-token cookie from the same claims, so
// src/middleware.ts and every existing getServerSession()/useSession() call
// across the app recognizes it without any of them having to change. NextAuth
// stays the thing that gates page access for now; this just makes sure it
// isn't a second, independently-fed authority — the claims all originate
// from this one place.
export async function establishWebSession(user: UserWithRelations, opts: EstablishWebSessionOptions) {
  const { accessToken, refreshToken } = await createSession({
    userId: user.id,
    email: user.email,
    role: user.role,
    ipAddress: opts.ipAddress,
    userAgent: opts.userAgent,
    deviceInfo: opts.deviceInfo,
  });

  const secret = process.env.NEXTAUTH_SECRET;
  if (!secret) throw new Error("NEXTAUTH_SECRET must be set — refusing to establish a web session with no secret to sign it");

  const claims = buildSessionClaims(user);
  const nextAuthToken = await encode({
    token: { ...claims, sub: user.id, email: user.email, name: user.name },
    secret,
    maxAge: NEXTAUTH_SESSION_MAX_AGE,
  });

  return { accessToken, refreshToken, nextAuthToken };
}

export function setWebSessionCookies(res: NextResponse, session: Awaited<ReturnType<typeof establishWebSession>>) {
  const secure = process.env.NODE_ENV === "production";
  res.cookies.set(COOKIE_ACCESS, session.accessToken, { httpOnly: true, secure, sameSite: "lax", maxAge: ACCESS_TOKEN_MAX_AGE, path: "/" });
  res.cookies.set(COOKIE_REFRESH, session.refreshToken, { httpOnly: true, secure, sameSite: "lax", maxAge: REFRESH_TOKEN_MAX_AGE, path: "/" });
  res.cookies.set(NEXTAUTH_COOKIE_NAME, session.nextAuthToken, { httpOnly: true, secure, sameSite: "lax", maxAge: NEXTAUTH_SESSION_MAX_AGE, path: "/" });
}
