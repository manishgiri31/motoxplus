import { NextRequest, NextResponse } from "next/server";
import { revokeSession } from "@/lib/auth/session";
import { requireAuth } from "@/lib/auth/middleware";
import { COOKIE_ACCESS, COOKIE_REFRESH } from "@/lib/auth/jwt";

export async function POST(req: NextRequest) {
  const authUser = await requireAuth(req);

  if (authUser?.sessionId) {
    await revokeSession(authUser.sessionId);
  }

  const res = NextResponse.json({ message: "Logged out successfully" });
  res.cookies.delete(COOKIE_ACCESS);
  res.cookies.delete(COOKIE_REFRESH);
  return res;
}
