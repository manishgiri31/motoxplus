import { NextRequest, NextResponse } from "next/server";
import { requireAdmin } from "@/lib/auth/require-admin";
import { prisma } from "@/lib/prisma";

export async function GET(_req: NextRequest, props: { params: Promise<{ id: string }> }) {
  const params = await props.params;
  if (!(await requireAdmin())) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const gallery = await prisma.vehicleGallery.findMany({
    where: { vehicleId: params.id },
    orderBy: { sortOrder: "asc" },
  });
  return NextResponse.json(gallery);
}

export async function POST(req: NextRequest, props: { params: Promise<{ id: string }> }) {
  const params = await props.params;
  if (!(await requireAdmin())) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const body = await req.json();
  if (!body.imageUrl?.trim()) {
    return NextResponse.json({ error: "imageUrl is required" }, { status: 400 });
  }

  const image = await prisma.vehicleGallery.create({
    data: {
      vehicleId: params.id,
      imageUrl: body.imageUrl.trim(),
      sortOrder: body.sortOrder ? parseInt(body.sortOrder) : 0,
    },
  });
  return NextResponse.json(image, { status: 201 });
}
