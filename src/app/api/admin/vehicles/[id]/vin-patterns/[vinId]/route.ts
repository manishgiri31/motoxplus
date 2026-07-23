import { NextRequest, NextResponse } from "next/server";
import { requireAdmin } from "@/lib/auth/require-admin";
import { prisma } from "@/lib/prisma";

export async function PATCH(
  req: NextRequest,
  props: { params: Promise<{ id: string; vinId: string }> }
) {
  const params = await props.params;
  if (!(await requireAdmin())) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const body = await req.json();
  const data: Record<string, unknown> = {};
  if (body.variantId !== undefined) data.variantId = body.variantId || null;
  if (body.wmi !== undefined) data.wmi = body.wmi.trim().toUpperCase();
  if (body.vdsPattern !== undefined) data.vdsPattern = body.vdsPattern?.trim() || null;
  if (body.yearCode !== undefined) data.yearCode = body.yearCode?.trim() || null;
  if (body.description !== undefined) data.description = body.description?.trim() || null;

  const pattern = await prisma.vehicleVinPattern.update({ where: { id: params.vinId }, data });
  return NextResponse.json(pattern);
}

export async function DELETE(
  _req: NextRequest,
  props: { params: Promise<{ id: string; vinId: string }> }
) {
  const params = await props.params;
  if (!(await requireAdmin())) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  await prisma.vehicleVinPattern.delete({ where: { id: params.vinId } });
  return NextResponse.json({ success: true });
}
