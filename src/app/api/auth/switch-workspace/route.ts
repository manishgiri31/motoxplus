import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { getCurrentUserId } from "@/lib/auth/current-user";
import { getAuthUser, getClientIP, getDeviceInfo } from "@/lib/auth/middleware";
import { checkIPRateLimit } from "@/lib/auth/rate-limit";
import { revokeSession } from "@/lib/auth/session";
import { establishWebSession, setWebSessionCookies } from "@/lib/auth/web-session";
import { WORKSPACE_INFO, switchError, type Workspace } from "@/lib/auth/workspaces";

/**
 * POST /api/auth/switch-workspace { workspace: "DEALER" | "CUSTOMER" | "VENDOR" }
 *
 * One login, several profiles (see lib/auth/workspaces.ts). Session plumbing like /api/auth/login, which is why it
 * lives in Node: only Node can mint the NextAuth cookie the pages read. The business side (creating a vendor
 * profile) is Java's POST /api/v1/vendors/attach.
 *
 * Checks the profile belongs to the signed-in account, makes it the active role, and re-issues all session cookies
 * (NextAuth + mx_access/mx_refresh, which the Java API reads) so every part of the app agrees at once.
 */
export async function POST(req: NextRequest) {
  const ip = getClientIP(req);
  if (!(await checkIPRateLimit(ip, 30, 60))) {
    return NextResponse.json({ error: "Too many requests. Try again in a minute." }, { status: 429 });
  }

  const userId = await getCurrentUserId(req);
  if (!userId) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const body = (await req.json().catch(() => ({}))) as { workspace?: unknown };
  const user = await prisma.user.findUnique({
    where: { id: userId },
    include: { dealer: true, vendor: true, admin: true, customer: true },
  });
  if (!user || !user.isActive) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const problem = switchError(user, body.workspace);
  if (problem) return NextResponse.json({ error: problem }, { status: 400 });
  const target = body.workspace as Workspace;

  const updated =
    user.role === target
      ? user
      : await prisma.user.update({
          where: { id: user.id },
          data: { role: target },
          include: { dealer: true, vendor: true, admin: true, customer: true },
        });

  // Replace the current session with one carrying the new role (the old access token would keep the old role for
  // up to 15 minutes otherwise).
  const current = await getAuthUser(req);
  if (current?.sessionId) await revokeSession(current.sessionId);
  const session = await establishWebSession(updated, {
    ipAddress: ip,
    userAgent: req.headers.get("user-agent") || undefined,
    deviceInfo: getDeviceInfo(req),
  });

  const redirectTo =
    target === "VENDOR" && updated.vendor?.status !== "APPROVED" ? "/vendor/onboarding" : WORKSPACE_INFO[target].home;
  const res = NextResponse.json({ workspace: target, redirectTo });
  setWebSessionCookies(res, session);
  return res;
}
