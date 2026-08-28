import { NextRequest } from "next/server";
import { verifyAccessToken, COOKIE_ACCESS, JWTPayload } from "./jwt";
import { prisma } from "@/lib/prisma";

/** The raw custom-JWT access token, from the mx_access cookie or a Bearer
 *  header. Presence (even of an invalid token) tells getCurrentUserId this is
 *  an API/mobile client, so it must NOT fall through to the NextAuth cookie. */
export function extractAccessToken(req: NextRequest): string | null {
  return (
    req.cookies.get(COOKIE_ACCESS)?.value ||
    req.headers.get("authorization")?.replace("Bearer ", "") ||
    null
  );
}

export async function getAuthUser(req: NextRequest): Promise<JWTPayload | null> {
  const token = extractAccessToken(req);
  if (!token) return null;

  const payload = await verifyAccessToken(token);
  if (!payload?.sessionId) return null;

  // F-14: `disable`, `logout-all`, and both password-reset routes flip
  // UserSession.isActive = false, but the access token stays cryptographically
  // valid for up to its 15-min lifetime. requireAuth already cross-checked the
  // session row; doing it here means every getCurrentUserId caller (i.e. every
  // dealer/mobile API route) gets that guarantee, not just the 3 routes on
  // requireAuth. One indexed-PK lookup per authenticated request.
  const session = await prisma.userSession.findUnique({
    where: { id: payload.sessionId },
    select: { isActive: true, expiresAt: true },
  });
  if (!session || !session.isActive || session.expiresAt < new Date()) return null;

  return payload;
}

/** Retained for the routes that call it directly (logout, logout-all, auth/me,
 *  auth/sessions). getAuthUser now performs the same session cross-check. */
export async function requireAuth(req: NextRequest) {
  return getAuthUser(req);
}

// Sentinel returned by getClientIP() when neither header is present (e.g.
// Nginx isn't setting X-Forwarded-For, or the app is hit directly bypassing
// the proxy). Rate-limiting call sites must treat this specially — keying a
// per-IP bucket on the literal string "unknown" collapses every client with
// no resolvable IP into one shared counter, which a single misconfigured
// proxy hop turns into a site-wide false-positive rate limit. See
// checkIPRateLimit() and enforceRateLimit() in rate-limit(-budgets).ts.
export const UNKNOWN_IP = "unknown";

export function getClientIP(req: NextRequest): string {
  return (
    req.headers.get("x-forwarded-for")?.split(",")[0]?.trim() ||
    req.headers.get("x-real-ip") ||
    UNKNOWN_IP
  );
}

export function getDeviceInfo(req: NextRequest): string {
  const ua = req.headers.get("user-agent") || "unknown";
  if (ua.includes("Mobile")) return "Mobile";
  if (ua.includes("Tablet")) return "Tablet";
  return "Desktop";
}
