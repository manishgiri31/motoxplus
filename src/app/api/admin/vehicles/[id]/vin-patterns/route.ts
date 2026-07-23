import { NextRequest, NextResponse } from "next/server";
import { requireAdmin } from "@/lib/auth/require-admin";
import { prisma } from "@/lib/prisma";

export async function GET(_req: NextRequest, props: { params: Promise<{ id: string }> }) {
  const params = await props.params;
  if (!(await requireAdmin())) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const patterns = await prisma.vehicleVinPattern.findMany({
    where: { vehicleId: params.id },
    orderBy: { createdAt: "desc" },
  });
  return NextResponse.json(patterns);
}

export async function POST(req: NextRequest, props: { params: Promise<{ id: string }> }) {
  const params = await props.params;
  if (!(await requireAdmin())) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const body = await req.json();
  if (!body.wmi?.trim()) {
    return NextResponse.json({ error: "wmi is required" }, { status: 400 });
  }

  const vehicle = await prisma.vehicle.findUnique({ where: { id: params.id }, select: { manufacturerId: true } });
  if (!vehicle) return NextResponse.json({ error: "Vehicle not found" }, { status: 404 });

  const pattern = await prisma.vehicleVinPattern.create({
    data: {
      vehicleId: params.id,
      manufacturerId: vehicle.manufacturerId,
      variantId: body.variantId || null,
      wmi: body.wmi.trim().toUpperCase(),
      vdsPattern: body.vdsPattern?.trim() || null,
      yearCode: body.yearCode?.trim() || null,
      description: body.description?.trim() || null,
    },
  });
  return NextResponse.json(pattern, { status: 201 });
}
