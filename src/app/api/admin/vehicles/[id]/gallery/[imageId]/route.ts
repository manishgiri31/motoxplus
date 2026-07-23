import { NextRequest, NextResponse } from "next/server";
import { requireAdmin } from "@/lib/auth/require-admin";
import { prisma } from "@/lib/prisma";

export async function PATCH(
  req: NextRequest,
  props: { params: Promise<{ id: string; imageId: string }> }
) {
  const params = await props.params;
  if (!(await requireAdmin())) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const body = await req.json();
  const data: Record<string, unknown> = {};
  if (body.imageUrl !== undefined) data.imageUrl = body.imageUrl.trim();
  if (body.sortOrder !== undefined) data.sortOrder = parseInt(body.sortOrder) || 0;

  const image = await prisma.vehicleGallery.update({ where: { id: params.imageId }, data });
  return NextResponse.json(image);
}

export async function DELETE(
  _req: NextRequest,
  props: { params: Promise<{ id: string; imageId: string }> }
) {
  const params = await props.params;
  if (!(await requireAdmin())) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  await prisma.vehicleGallery.delete({ where: { id: params.imageId } });
  return NextResponse.json({ success: true });
}
