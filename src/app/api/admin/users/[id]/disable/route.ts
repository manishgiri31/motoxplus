import { NextRequest, NextResponse } from "next/server";
import { getServerSession } from "next-auth";
import { authOptions } from "@/lib/auth";
import { prisma } from "@/lib/prisma";
import { revokeAllSessions } from "@/lib/auth/session";

export async function POST(req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const session = await getServerSession(authOptions);
  if (!session || !["ADMIN", "SUPER_ADMIN"].includes(session.user.role)) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const { id } = await params;
  const { disable } = await req.json();

  if (id === session.user.id) {
    return NextResponse.json({ error: "Cannot disable your own account" }, { status: 400 });
  }

  const user = await prisma.user.update({
    where: { id },
    data: { isActive: disable !== false },
    select: { id: true, email: true, isActive: true },
  });

  if (!user.isActive) {
    await revokeAllSessions(id);
  }

  return NextResponse.json({ user, message: user.isActive ? "Account enabled" : "Account disabled and sessions revoked" });
}
