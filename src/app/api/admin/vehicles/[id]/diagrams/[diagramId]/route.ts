import { NextRequest, NextResponse } from "next/server";
import { requireAdmin } from "@/lib/auth/require-admin";
import { prisma } from "@/lib/prisma";

export async function PATCH(req: NextRequest, { params }: { params: { id: string; diagramId: string } }) {
  if (!(await requireAdmin())) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const body = await req.json();
  const data: Record<string, unknown> = {};
  if (body.name !== undefined) data.name = body.name.trim();
  if (body.imageUrl !== undefined) data.imageUrl = body.imageUrl.trim();
  if (body.generationId !== undefined) data.generationId = body.generationId || null;
  if (body.sectionId !== undefined) data.sectionId = body.sectionId || null;
  if (body.sortOrder !== undefined) data.sortOrder = parseInt(body.sortOrder) || 0;
  if (body.isActive !== undefined) data.isActive = body.isActive === true || body.isActive === "true";

  const diagram = await prisma.vehicleDiagram.update({ where: { id: params.diagramId }, data });
  return NextResponse.json(diagram);
}

export async function DELETE(_req: NextRequest, { params }: { params: { id: string; diagramId: string } }) {
  if (!(await requireAdmin())) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  await prisma.vehicleDiagram.delete({ where: { id: params.diagramId } });
  return NextResponse.json({ success: true });
}
