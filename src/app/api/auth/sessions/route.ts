import { NextRequest, NextResponse } from "next/server";
import { getUserSessions, revokeSession } from "@/lib/auth/session";
import { requireAuth } from "@/lib/auth/middleware";

export async function GET(req: NextRequest) {
  const authUser = await requireAuth(req);
  if (!authUser) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const sessions = await getUserSessions(authUser.userId);
  return NextResponse.json({ sessions, currentSessionId: authUser.sessionId });
}

export async function DELETE(req: NextRequest) {
  const authUser = await requireAuth(req);
  if (!authUser) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const { sessionId } = await req.json();
  if (!sessionId) return NextResponse.json({ error: "Session ID required" }, { status: 400 });

  // Verify this session belongs to the current user
  const { prisma } = await import("@/lib/prisma");
  const session = await prisma.userSession.findUnique({ where: { id: sessionId }, select: { userId: true } });
  if (!session || session.userId !== authUser.userId) {
    return NextResponse.json({ error: "Session not found" }, { status: 404 });
  }

  await revokeSession(sessionId);
  return NextResponse.json({ message: "Session revoked" });
}
