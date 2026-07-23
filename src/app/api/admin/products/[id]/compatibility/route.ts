import { NextRequest, NextResponse } from "next/server";
import { requireAdmin } from "@/lib/auth/require-admin";
import { prisma } from "@/lib/prisma";

export async function GET(_req: NextRequest, props: { params: Promise<{ id: string }> }) {
  const params = await props.params;
  if (!(await requireAdmin())) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const rows = await prisma.productCompatibility.findMany({
    where: { productId: params.id },
    orderBy: { createdAt: "desc" },
    include: {
      vehicle: { select: { id: true, name: true } },
      generation: { select: { id: true, name: true } },
      variant: { select: { id: true, name: true } },
      section: { select: { id: true, name: true } },
    },
  });
  return NextResponse.json(rows);
}

export async function POST(req: NextRequest, props: { params: Promise<{ id: string }> }) {
  const params = await props.params;
  if (!(await requireAdmin())) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const body = await req.json();
  if (!body.vehicleId) {
    return NextResponse.json({ error: "vehicleId is required" }, { status: 400 });
  }

  const row = await prisma.productCompatibility.create({
    data: {
      productId: params.id,
      vehicleId: body.vehicleId,
      generationId: body.generationId || null,
      variantId: body.variantId || null,
      sectionId: body.sectionId || null,
      yearFrom: body.yearFrom ? parseInt(body.yearFrom) : null,
      yearTo: body.yearTo ? parseInt(body.yearTo) : null,
      emissionStandard: body.emissionStandard || null,
      position: body.position?.trim() || null,
      confidence: body.confidence || "LIKELY",
      confidenceScore: body.confidenceScore ? parseFloat(body.confidenceScore) : null,
      source: body.source || "MANUAL",
      fitmentNote: body.fitmentNote?.trim() || null,
      isActive: body.isActive === "false" ? false : true,
    },
    include: {
      vehicle: { select: { id: true, name: true } },
      generation: { select: { id: true, name: true } },
      variant: { select: { id: true, name: true } },
      section: { select: { id: true, name: true } },
    },
  });
  return NextResponse.json(row, { status: 201 });
}
