import { NextRequest, NextResponse } from "next/server";
import { requireAdmin } from "@/lib/auth/require-admin";
import { prisma } from "@/lib/prisma";

export async function PATCH(req: NextRequest, { params }: { params: { id: string; compatId: string } }) {
  if (!(await requireAdmin())) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const body = await req.json();
  const data: Record<string, unknown> = {};
  if (body.vehicleId !== undefined) data.vehicleId = body.vehicleId || null;
  if (body.generationId !== undefined) data.generationId = body.generationId || null;
  if (body.variantId !== undefined) data.variantId = body.variantId || null;
  if (body.sectionId !== undefined) data.sectionId = body.sectionId || null;
  if (body.yearFrom !== undefined) data.yearFrom = body.yearFrom ? parseInt(body.yearFrom) : null;
  if (body.yearTo !== undefined) data.yearTo = body.yearTo ? parseInt(body.yearTo) : null;
  if (body.emissionStandard !== undefined) data.emissionStandard = body.emissionStandard || null;
  if (body.position !== undefined) data.position = body.position?.trim() || null;
  if (body.confidence !== undefined) data.confidence = body.confidence;
  if (body.confidenceScore !== undefined) data.confidenceScore = body.confidenceScore ? parseFloat(body.confidenceScore) : null;
  if (body.source !== undefined) data.source = body.source;
  if (body.fitmentNote !== undefined) data.fitmentNote = body.fitmentNote?.trim() || null;
  if (body.isActive !== undefined) data.isActive = body.isActive === true || body.isActive === "true";

  const row = await prisma.productCompatibility.update({
    where: { id: params.compatId },
    data,
    include: {
      vehicle: { select: { id: true, name: true } },
      generation: { select: { id: true, name: true } },
      variant: { select: { id: true, name: true } },
      section: { select: { id: true, name: true } },
    },
  });
  return NextResponse.json(row);
}

export async function DELETE(_req: NextRequest, { params }: { params: { id: string; compatId: string } }) {
  if (!(await requireAdmin())) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  await prisma.productCompatibility.delete({ where: { id: params.compatId } });
  return NextResponse.json({ success: true });
}
