import { NextRequest, NextResponse } from "next/server";
import { requireAdmin } from "@/lib/auth/require-admin";
import { prisma } from "@/lib/prisma";

export async function PATCH(req: NextRequest, { params }: { params: { id: string; colorId: string } }) {
  if (!(await requireAdmin())) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const body = await req.json();
  const data: Record<string, unknown> = {};
  if (body.name !== undefined) data.name = body.name.trim();
  if (body.hex !== undefined) data.hex = body.hex.trim();
  if (body.image !== undefined) data.image = body.image?.trim() || null;
  if (body.oemColorId !== undefined) data.oemColorId = body.oemColorId || null;
  if (body.sortOrder !== undefined) data.sortOrder = parseInt(body.sortOrder) || 0;

  const color = await prisma.vehicleColor.update({ where: { id: params.colorId }, data, include: { oemColor: true } });
  return NextResponse.json(color);
}

export async function DELETE(_req: NextRequest, { params }: { params: { id: string; colorId: string } }) {
  if (!(await requireAdmin())) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  await prisma.vehicleColor.delete({ where: { id: params.colorId } });
  return NextResponse.json({ success: true });
}
