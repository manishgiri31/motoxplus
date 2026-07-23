import { NextRequest, NextResponse } from "next/server";
import { requireAdmin } from "@/lib/auth/require-admin";
import { prisma } from "@/lib/prisma";

export async function GET(_req: NextRequest, props: { params: Promise<{ id: string }> }) {
  const params = await props.params;
  if (!(await requireAdmin())) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const manufacturer = await prisma.vehicleManufacturer.findUnique({ where: { id: params.id } });
  if (!manufacturer) return NextResponse.json({ error: "Not found" }, { status: 404 });
  return NextResponse.json(manufacturer);
}

export async function PATCH(req: NextRequest, props: { params: Promise<{ id: string }> }) {
  const params = await props.params;
  if (!(await requireAdmin())) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const body = await req.json();
  const data: Record<string, unknown> = {};
  if (body.name !== undefined) data.name = body.name.trim();
  if (body.slug !== undefined) data.slug = body.slug.trim().toLowerCase();
  if (body.logo !== undefined) data.logo = body.logo?.trim() || null;
  if (body.wmi !== undefined) data.wmi = body.wmi?.trim().toUpperCase() || null;
  if (body.sortOrder !== undefined) data.sortOrder = parseInt(body.sortOrder) || 0;
  if (body.isActive !== undefined) data.isActive = body.isActive === true || body.isActive === "true";

  const manufacturer = await prisma.vehicleManufacturer.update({ where: { id: params.id }, data });
  return NextResponse.json(manufacturer);
}

export async function DELETE(_req: NextRequest, props: { params: Promise<{ id: string }> }) {
  const params = await props.params;
  if (!(await requireAdmin())) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  await prisma.vehicleManufacturer.delete({ where: { id: params.id } });
  return NextResponse.json({ success: true });
}
