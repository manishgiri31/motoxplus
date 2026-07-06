import { NextRequest, NextResponse } from "next/server";
import { requireAdmin } from "@/lib/auth/require-admin";
import { prisma } from "@/lib/prisma";

export async function PATCH(req: NextRequest, { params }: { params: { id: string; genId: string } }) {
  if (!(await requireAdmin())) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const body = await req.json();
  const data: Record<string, unknown> = {};
  if (body.name !== undefined) data.name = body.name.trim();
  if (body.codeName !== undefined) data.codeName = body.codeName?.trim() || null;
  if (body.yearFrom !== undefined) data.yearFrom = parseInt(body.yearFrom);
  if (body.yearTo !== undefined) data.yearTo = body.yearTo ? parseInt(body.yearTo) : null;
  if (body.description !== undefined) data.description = body.description?.trim() || null;
  if (body.sortOrder !== undefined) data.sortOrder = parseInt(body.sortOrder) || 0;
  if (body.isActive !== undefined) data.isActive = body.isActive === true || body.isActive === "true";

  const generation = await prisma.vehicleGeneration.update({ where: { id: params.genId }, data });
  return NextResponse.json(generation);
}

export async function DELETE(_req: NextRequest, { params }: { params: { id: string; genId: string } }) {
  if (!(await requireAdmin())) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  await prisma.vehicleGeneration.delete({ where: { id: params.genId } });
  return NextResponse.json({ success: true });
}
