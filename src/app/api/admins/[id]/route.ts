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

// PATCH /api/admins/:id — toggle super admin
export async function PATCH(req: NextRequest, props: { params: Promise<{ id: string }> }) {
  const params = await props.params;
  const session = await getServerSession(authOptions);
  const deny = superAdminOnly(session);
  if (deny) return deny;

  const { isSuperAdmin } = await req.json();
  const admin = await prisma.admin.findUnique({ where: { id: params.id } });
  if (!admin) return NextResponse.json({ error: "Admin not found" }, { status: 404 });

  if (admin.userId === session!.user.id) {
    return NextResponse.json({ error: "Cannot modify your own admin level" }, { status: 400 });
  }

  const [updated] = await prisma.$transaction([
    prisma.admin.update({ where: { id: params.id }, data: { isSuperAdmin } }),
    prisma.user.update({
      where: { id: admin.userId },
      data: { role: isSuperAdmin ? "SUPER_ADMIN" : "ADMIN" },
    }),
  ]);

  return NextResponse.json(updated);
}

// DELETE /api/admins/:id — revoke admin
export async function DELETE(_req: NextRequest, props: { params: Promise<{ id: string }> }) {
  const params = await props.params;
  const session = await getServerSession(authOptions);
  const deny = superAdminOnly(session);
  if (deny) return deny;

  const admin = await prisma.admin.findUnique({ where: { id: params.id } });
  if (!admin) return NextResponse.json({ error: "Admin not found" }, { status: 404 });

  if (admin.userId === session!.user.id) {
    return NextResponse.json({ error: "Cannot revoke your own admin access" }, { status: 400 });
  }

  await prisma.$transaction([
    prisma.admin.delete({ where: { id: params.id } }),
    prisma.user.update({ where: { id: admin.userId }, data: { role: "GUEST" } }),
  ]);

  return NextResponse.json({ deleted: true });
}
