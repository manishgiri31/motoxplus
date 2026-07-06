import { NextRequest, NextResponse } from "next/server";
import { requireAdmin } from "@/lib/auth/require-admin";
import { prisma } from "@/lib/prisma";

export async function GET(_req: NextRequest, { params }: { params: { id: string } }) {
  if (!(await requireAdmin())) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const colors = await prisma.oemColor.findMany({
    where: { manufacturerId: params.id },
    orderBy: [{ sortOrder: "asc" }, { name: "asc" }],
  });
  return NextResponse.json(colors);
}

export async function POST(req: NextRequest, { params }: { params: { id: string } }) {
  if (!(await requireAdmin())) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const body = await req.json();
  const { name, colorCode, paintCode, hex, finish, sortOrder, isActive } = body;
  if (!name?.trim() || !hex?.trim()) {
    return NextResponse.json({ error: "name and hex are required" }, { status: 400 });
  }

  const color = await prisma.oemColor.create({
    data: {
      manufacturerId: params.id,
      name: name.trim(),
      colorCode: colorCode?.trim() || null,
      paintCode: paintCode?.trim() || null,
      hex: hex.trim(),
      finish: finish?.trim() || null,
      sortOrder: sortOrder ? parseInt(sortOrder) : 0,
      isActive: isActive === "false" ? false : true,
    },
  });
  return NextResponse.json(color, { status: 201 });
}
