import { NextRequest, NextResponse } from "next/server";
import { requireAdmin } from "@/lib/auth/require-admin";
import { prisma } from "@/lib/prisma";

export async function PATCH(
  req: NextRequest,
  { params }: { params: { id: string; diagramId: string; hotspotId: string } }
) {
  if (!(await requireAdmin())) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const body = await req.json();
  const data: Record<string, unknown> = {};
  if (body.x !== undefined) data.x = parseFloat(body.x);
  if (body.y !== undefined) data.y = parseFloat(body.y);
  if (body.label !== undefined) data.label = body.label.trim();
  if (body.calloutNumber !== undefined) data.calloutNumber = body.calloutNumber ? parseInt(body.calloutNumber) : null;
  if (body.sectionId !== undefined) data.sectionId = body.sectionId || null;
  if (body.productId !== undefined) data.productId = body.productId || null;
  if (body.sortOrder !== undefined) data.sortOrder = parseInt(body.sortOrder) || 0;

  const hotspot = await prisma.vehicleDiagramHotspot.update({ where: { id: params.hotspotId }, data });
  return NextResponse.json(hotspot);
}

export async function DELETE(
  _req: NextRequest,
  { params }: { params: { id: string; diagramId: string; hotspotId: string } }
) {
  if (!(await requireAdmin())) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  await prisma.vehicleDiagramHotspot.delete({ where: { id: params.hotspotId } });
  return NextResponse.json({ success: true });
}
