import { NextRequest, NextResponse } from "next/server";
import { requireAdmin } from "@/lib/auth/require-admin";
import { prisma } from "@/lib/prisma";

export async function GET(_req: NextRequest, { params }: { params: { id: string } }) {
  if (!(await requireAdmin())) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const variants = await prisma.vehicleVariant.findMany({
    where: { vehicleId: params.id },
    orderBy: { sortOrder: "asc" },
  });
  return NextResponse.json(variants);
}

export async function POST(req: NextRequest, { params }: { params: { id: string } }) {
  if (!(await requireAdmin())) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const body = await req.json();
  const { name, slug } = body;
  if (!name?.trim() || !slug?.trim()) {
    return NextResponse.json({ error: "name and slug are required" }, { status: 400 });
  }

  try {
    const variant = await prisma.vehicleVariant.create({
      data: {
        vehicleId: params.id,
        generationId: body.generationId || null,
        name: name.trim(),
        slug: slug.trim().toLowerCase(),
        emissionStandard: body.emissionStandard || null,
        brakeType: body.brakeType?.trim() || null,
        startType: body.startType?.trim() || null,
        transmission: body.transmission?.trim() || null,
        fuelType: body.fuelType?.trim() || null,
        engineCc: body.engineCc ? parseFloat(body.engineCc) : null,
        yearFrom: body.yearFrom ? parseInt(body.yearFrom) : null,
        yearTo: body.yearTo ? parseInt(body.yearTo) : null,
        chassisPrefix: body.chassisPrefix?.trim() || null,
        sortOrder: body.sortOrder ? parseInt(body.sortOrder) : 0,
        isActive: body.isActive === "false" ? false : true,
      },
    });
    return NextResponse.json(variant, { status: 201 });
  } catch (err: unknown) {
    if (typeof err === "object" && err && "code" in err && (err as { code?: string }).code === "P2002") {
      return NextResponse.json({ error: "A variant with this slug already exists for this vehicle" }, { status: 409 });
    }
    throw err;
  }
}
