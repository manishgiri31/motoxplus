import { NextRequest, NextResponse } from "next/server";
import bcrypt from "bcryptjs";
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
  const { newPassword } = await req.json();

  if (!newPassword || newPassword.length < 8) {
    return NextResponse.json({ error: "Password must be at least 8 characters" }, { status: 400 });
  }

  const hashed = await bcrypt.hash(newPassword, 12);

  await prisma.user.update({
    where: { id },
    data: { password: hashed, failedLoginAttempts: 0, accountLockedUntil: null },
  });

  await revokeAllSessions(id);

  return NextResponse.json({ message: "Password reset and all sessions revoked" });
}
