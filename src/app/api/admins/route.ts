import { NextRequest, NextResponse } from "next/server";
import { getServerSession } from "next-auth";
import { authOptions } from "@/lib/auth";
import { prisma } from "@/lib/prisma";

function superAdminOnly(session: any) {
  if (!session || !session.user.isSuperAdmin) {
    return NextResponse.json({ error: "Forbidden" }, { status: 403 });
  }
  return null;
}

// POST /api/admins — promote a user to admin
export async function POST(req: NextRequest) {
  const session = await getServerSession(authOptions);
  const deny = superAdminOnly(session);
  if (deny) return deny;

  const { userId, isSuperAdmin = false } = await req.json();
  if (!userId) return NextResponse.json({ error: "userId required" }, { status: 400 });

  const user = await prisma.user.findUnique({ where: { id: userId } });
  if (!user) return NextResponse.json({ error: "User not found" }, { status: 404 });

  const existing = await prisma.admin.findUnique({ where: { userId } });
  if (existing) return NextResponse.json({ error: "User is already an admin" }, { status: 409 });

  const [admin] = await prisma.$transaction([
    prisma.admin.create({ data: { userId, isSuperAdmin } }),
    prisma.user.update({ where: { id: userId }, data: { role: isSuperAdmin ? "SUPER_ADMIN" : "ADMIN" } }),
  ]);

  return NextResponse.json(admin, { status: 201 });
}
