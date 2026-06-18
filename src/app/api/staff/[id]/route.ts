import { NextRequest, NextResponse } from "next/server";
import { getServerSession } from "next-auth";
import { authOptions } from "@/lib/auth";
import { prisma } from "@/lib/prisma";

const ADMIN_ROLES = ["ADMIN", "SUPER_ADMIN"];

export async function PATCH(req: NextRequest, { params }: { params: { id: string } }) {
  const session = await getServerSession(authOptions);
  if (!session || !ADMIN_ROLES.includes(session.user.role)) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const { name, department } = await req.json();
  const data: any = {};
  if (name) data.name = name;
  if (department) data.department = department;

  const user = await prisma.user.update({
    where: { id: params.id, role: "STAFF" },
    data,
    select: { id: true, name: true, email: true, department: true },
  });

  return NextResponse.json(user);
}

export async function DELETE(req: NextRequest, { params }: { params: { id: string } }) {
  const session = await getServerSession(authOptions);
  if (!session || !ADMIN_ROLES.includes(session.user.role)) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  await prisma.user.delete({ where: { id: params.id, role: "STAFF" } });
  return NextResponse.json({ success: true });
}
