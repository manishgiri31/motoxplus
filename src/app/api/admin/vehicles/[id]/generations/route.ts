import { NextRequest, NextResponse } from "next/server";
import { requireAdmin } from "@/lib/auth/require-admin";
import { prisma } from "@/lib/prisma";

export async function GET(_req: NextRequest, props: { params: Promise<{ id: string }> }) {
  const params = await props.params;
  if (!(await requireAdmin())) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const generations = await prisma.vehicleGeneration.findMany({
    where: { vehicleId: params.id },
    orderBy: { sortOrder: "asc" },
  });
  return NextResponse.json(generations);
}

export async function POST(req: NextRequest, props: { params: Promise<{ id: string }> }) {
  const params = await props.params;
  if (!(await requireAdmin())) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const body = await req.json();
  const { name, yearFrom } = body;
  if (!name?.trim() || !yearFrom) {
    return NextResponse.json({ error: "name and yearFrom are required" }, { status: 400 });
  }

  const generation = await prisma.vehicleGeneration.create({
    data: {
      vehicleId: params.id,
      name: name.trim(),
      codeName: body.codeName?.trim() || null,
      yearFrom: parseInt(yearFrom),
      yearTo: body.yearTo ? parseInt(body.yearTo) : null,
      description: body.description?.trim() || null,
      sortOrder: body.sortOrder ? parseInt(body.sortOrder) : 0,
      isActive: body.isActive === "false" ? false : true,
    },
  });
  return NextResponse.json(generation, { status: 201 });
}
