import { NextRequest, NextResponse } from "next/server";
import { requireAdmin } from "@/lib/auth/require-admin";
import { prisma } from "@/lib/prisma";

export async function PATCH(req: NextRequest, { params }: { params: { id: string; colorId: string } }) {
  if (!(await requireAdmin())) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const body = await req.json();
  const data: Record<string, unknown> = {};
  if (body.name !== undefined) data.name = body.name.trim();
  if (body.colorCode !== undefined) data.colorCode = body.colorCode?.trim() || null;
  if (body.paintCode !== undefined) data.paintCode = body.paintCode?.trim() || null;
  if (body.hex !== undefined) data.hex = body.hex.trim();
  if (body.finish !== undefined) data.finish = body.finish?.trim() || null;
  if (body.sortOrder !== undefined) data.sortOrder = parseInt(body.sortOrder) || 0;
  if (body.isActive !== undefined) data.isActive = body.isActive === true || body.isActive === "true";

  const color = await prisma.oemColor.update({ where: { id: params.colorId }, data });
  return NextResponse.json(color);
}

export async function DELETE(_req: NextRequest, { params }: { params: { id: string; colorId: string } }) {
  if (!(await requireAdmin())) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  await prisma.oemColor.delete({ where: { id: params.colorId } });
  return NextResponse.json({ success: true });
}
