import { NextRequest, NextResponse } from "next/server";
import { requireAdmin } from "@/lib/auth/require-admin";
import { prisma } from "@/lib/prisma";

export async function PATCH(req: NextRequest, { params }: { params: { id: string; variantId: string } }) {
  if (!(await requireAdmin())) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const body = await req.json();
  const data: Record<string, unknown> = {};
  if (body.name !== undefined) data.name = body.name.trim();
  if (body.slug !== undefined) data.slug = body.slug.trim().toLowerCase();
  if (body.generationId !== undefined) data.generationId = body.generationId || null;
  if (body.emissionStandard !== undefined) data.emissionStandard = body.emissionStandard || null;
  if (body.brakeType !== undefined) data.brakeType = body.brakeType?.trim() || null;
  if (body.startType !== undefined) data.startType = body.startType?.trim() || null;
  if (body.transmission !== undefined) data.transmission = body.transmission?.trim() || null;
  if (body.fuelType !== undefined) data.fuelType = body.fuelType?.trim() || null;
  if (body.engineCc !== undefined) data.engineCc = body.engineCc ? parseFloat(body.engineCc) : null;
  if (body.yearFrom !== undefined) data.yearFrom = body.yearFrom ? parseInt(body.yearFrom) : null;
  if (body.yearTo !== undefined) data.yearTo = body.yearTo ? parseInt(body.yearTo) : null;
  if (body.chassisPrefix !== undefined) data.chassisPrefix = body.chassisPrefix?.trim() || null;
  if (body.sortOrder !== undefined) data.sortOrder = parseInt(body.sortOrder) || 0;
  if (body.isActive !== undefined) data.isActive = body.isActive === true || body.isActive === "true";

  const variant = await prisma.vehicleVariant.update({ where: { id: params.variantId }, data });
  return NextResponse.json(variant);
}

export async function DELETE(_req: NextRequest, { params }: { params: { id: string; variantId: string } }) {
  if (!(await requireAdmin())) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  await prisma.vehicleVariant.delete({ where: { id: params.variantId } });
  return NextResponse.json({ success: true });
}
