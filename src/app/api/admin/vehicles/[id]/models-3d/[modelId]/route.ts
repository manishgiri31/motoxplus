import { NextRequest, NextResponse } from "next/server";
import { requireAdmin } from "@/lib/auth/require-admin";
import { prisma } from "@/lib/prisma";

export async function PATCH(
  req: NextRequest,
  props: { params: Promise<{ id: string; modelId: string }> }
) {
  const params = await props.params;
  if (!(await requireAdmin())) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const body = await req.json();
  const data: Record<string, unknown> = {};
  if (body.variantId !== undefined) data.variantId = body.variantId || null;
  if (body.colorId !== undefined) data.colorId = body.colorId || null;
  if (body.format !== undefined) data.format = body.format;
  if (body.url !== undefined) data.url = body.url.trim();
  if (body.sortOrder !== undefined) data.sortOrder = parseInt(body.sortOrder) || 0;

  const model = await prisma.vehicleModel3D.update({ where: { id: params.modelId }, data });
  return NextResponse.json(model);
}

export async function DELETE(
  _req: NextRequest,
  props: { params: Promise<{ id: string; modelId: string }> }
) {
  const params = await props.params;
  if (!(await requireAdmin())) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  await prisma.vehicleModel3D.delete({ where: { id: params.modelId } });
  return NextResponse.json({ success: true });
}
