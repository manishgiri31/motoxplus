import { NextRequest, NextResponse } from "next/server";
import { requireAdmin } from "@/lib/auth/require-admin";
import { prisma } from "@/lib/prisma";

export async function PATCH(req: NextRequest, { params }: { params: { id: string; accessoryId: string } }) {
  if (!(await requireAdmin())) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const body = await req.json();
  const data: Record<string, unknown> = {};
  if (body.sortOrder !== undefined) data.sortOrder = parseInt(body.sortOrder) || 0;

  const accessory = await prisma.vehicleAccessory.update({ where: { id: params.accessoryId }, data });
  return NextResponse.json(accessory);
}

export async function DELETE(_req: NextRequest, { params }: { params: { id: string; accessoryId: string } }) {
  if (!(await requireAdmin())) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  await prisma.vehicleAccessory.delete({ where: { id: params.accessoryId } });
  return NextResponse.json({ success: true });
}
