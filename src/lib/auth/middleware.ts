import { NextRequest } from "next/server";
import { verifyAccessToken, COOKIE_ACCESS, JWTPayload } from "./jwt";
import { prisma } from "@/lib/prisma";

export async function getAuthUser(req: NextRequest): Promise<JWTPayload | null> {
  const token = req.cookies.get(COOKIE_ACCESS)?.value
    || req.headers.get("authorization")?.replace("Bearer ", "");

  if (!token) return null;
  return verifyAccessToken(token);
}

export async function requireAuth(req: NextRequest) {
  const user = await getAuthUser(req);
  if (!user) return null;

  // Verify session is still active
  const session = await prisma.userSession.findUnique({
    where: { id: user.sessionId },
    select: { isActive: true, expiresAt: true },
  });

  if (!session?.isActive || session.expiresAt < new Date()) return null;
  return user;
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
