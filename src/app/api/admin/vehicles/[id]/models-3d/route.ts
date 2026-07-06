import { NextRequest, NextResponse } from "next/server";
import { requireAdmin } from "@/lib/auth/require-admin";
import { prisma } from "@/lib/prisma";

export async function GET(_req: NextRequest, { params }: { params: { id: string } }) {
  if (!(await requireAdmin())) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const models = await prisma.vehicleModel3D.findMany({
    where: { vehicleId: params.id },
    orderBy: { sortOrder: "asc" },
  });
  return NextResponse.json(models);
}

export async function POST(req: NextRequest, { params }: { params: { id: string } }) {
  if (!(await requireAdmin())) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const body = await req.json();
  if (!body.url?.trim()) {
    return NextResponse.json({ error: "url is required" }, { status: 400 });
  }

  const model = await prisma.vehicleModel3D.create({
    data: {
      vehicleId: params.id,
      variantId: body.variantId || null,
      colorId: body.colorId || null,
      format: body.format || "GLB",
      url: body.url.trim(),
      sortOrder: body.sortOrder ? parseInt(body.sortOrder) : 0,
    },
  });
  return NextResponse.json(model, { status: 201 });
}
