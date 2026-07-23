import { NextRequest, NextResponse } from "next/server";
import { requireAdmin } from "@/lib/auth/require-admin";
import { prisma } from "@/lib/prisma";

export async function GET(_req: NextRequest, props: { params: Promise<{ id: string }> }) {
  const params = await props.params;
  if (!(await requireAdmin())) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const diagrams = await prisma.vehicleDiagram.findMany({
    where: { vehicleId: params.id },
    orderBy: { sortOrder: "asc" },
    include: { hotspots: { orderBy: { sortOrder: "asc" } } },
  });
  return NextResponse.json(diagrams);
}

export async function POST(req: NextRequest, props: { params: Promise<{ id: string }> }) {
  const params = await props.params;
  if (!(await requireAdmin())) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const body = await req.json();
  if (!body.name?.trim() || !body.imageUrl?.trim()) {
    return NextResponse.json({ error: "name and imageUrl are required" }, { status: 400 });
  }

  const diagram = await prisma.vehicleDiagram.create({
    data: {
      vehicleId: params.id,
      name: body.name.trim(),
      imageUrl: body.imageUrl.trim(),
      generationId: body.generationId || null,
      sectionId: body.sectionId || null,
      sortOrder: body.sortOrder ? parseInt(body.sortOrder) : 0,
      isActive: body.isActive === "false" ? false : true,
    },
    include: { hotspots: true },
  });
  return NextResponse.json(diagram, { status: 201 });
}
