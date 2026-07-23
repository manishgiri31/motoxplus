import { NextRequest, NextResponse } from "next/server";
import { requireAdmin } from "@/lib/auth/require-admin";
import { prisma } from "@/lib/prisma";

export async function GET(_req: NextRequest, props: { params: Promise<{ id: string }> }) {
  const params = await props.params;
  if (!(await requireAdmin())) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const colors = await prisma.vehicleColor.findMany({
    where: { vehicleId: params.id },
    orderBy: { sortOrder: "asc" },
    include: { oemColor: true },
  });
  return NextResponse.json(colors);
}

export async function POST(req: NextRequest, props: { params: Promise<{ id: string }> }) {
  const params = await props.params;
  if (!(await requireAdmin())) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const body = await req.json();
  const { name, hex } = body;
  if (!name?.trim() || !hex?.trim()) {
    return NextResponse.json({ error: "name and hex are required" }, { status: 400 });
  }

  const color = await prisma.vehicleColor.create({
    data: {
      vehicleId: params.id,
      name: name.trim(),
      hex: hex.trim(),
      image: body.image?.trim() || null,
      oemColorId: body.oemColorId || null,
      sortOrder: body.sortOrder ? parseInt(body.sortOrder) : 0,
    },
    include: { oemColor: true },
  });
  return NextResponse.json(color, { status: 201 });
}
