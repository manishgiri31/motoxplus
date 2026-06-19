import { NextRequest, NextResponse } from "next/server";
import { revokeAllSessions } from "@/lib/auth/session";
import { requireAuth } from "@/lib/auth/middleware";
import { COOKIE_ACCESS, COOKIE_REFRESH } from "@/lib/auth/jwt";

export async function POST(req: NextRequest) {
  const authUser = await requireAuth(req);
  if (!authUser) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  await revokeAllSessions(authUser.userId);

  const res = NextResponse.json({ message: "Logged out from all sessions" });
  res.cookies.delete(COOKIE_ACCESS);
  res.cookies.delete(COOKIE_REFRESH);
  return res;
}
