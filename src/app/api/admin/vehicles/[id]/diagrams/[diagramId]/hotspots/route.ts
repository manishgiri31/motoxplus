import { NextRequest, NextResponse } from "next/server";
import { requireAdmin } from "@/lib/auth/require-admin";
import { prisma } from "@/lib/prisma";

export async function GET(
  _req: NextRequest,
  props: { params: Promise<{ id: string; diagramId: string }> }
) {
  const params = await props.params;
  if (!(await requireAdmin())) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const hotspots = await prisma.vehicleDiagramHotspot.findMany({
    where: { diagramId: params.diagramId },
    orderBy: { sortOrder: "asc" },
  });
  return NextResponse.json(hotspots);
}

export async function POST(
  req: NextRequest,
  props: { params: Promise<{ id: string; diagramId: string }> }
) {
  const params = await props.params;
  if (!(await requireAdmin())) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const body = await req.json();
  if (body.x == null || body.y == null || !body.label?.trim()) {
    return NextResponse.json({ error: "x, y and label are required" }, { status: 400 });
  }

  const hotspot = await prisma.vehicleDiagramHotspot.create({
    data: {
      diagramId: params.diagramId,
      x: parseFloat(body.x),
      y: parseFloat(body.y),
      label: body.label.trim(),
      calloutNumber: body.calloutNumber ? parseInt(body.calloutNumber) : null,
      sectionId: body.sectionId || null,
      productId: body.productId || null,
      sortOrder: body.sortOrder ? parseInt(body.sortOrder) : 0,
    },
  });
  return NextResponse.json(hotspot, { status: 201 });
}
