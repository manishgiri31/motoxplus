import { NextRequest, NextResponse } from "next/server";
import { requireAdmin } from "@/lib/auth/require-admin";
import { prisma } from "@/lib/prisma";

export async function GET() {
  if (!(await requireAdmin())) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const manufacturers = await prisma.vehicleManufacturer.findMany({
    orderBy: [{ sortOrder: "asc" }, { name: "asc" }],
    include: { _count: { select: { vehicles: true, oemColors: true } } },
  });
  return NextResponse.json(manufacturers);
}

export async function POST(req: NextRequest) {
  if (!(await requireAdmin())) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const body = await req.json();
  const { name, slug, logo, wmi, sortOrder, isActive } = body;
  if (!name?.trim() || !slug?.trim()) {
    return NextResponse.json({ error: "name and slug are required" }, { status: 400 });
  }

  const manufacturer = await prisma.vehicleManufacturer.create({
    data: {
      name: name.trim(),
      slug: slug.trim().toLowerCase(),
      logo: logo?.trim() || null,
      wmi: wmi?.trim().toUpperCase() || null,
      sortOrder: sortOrder ? parseInt(sortOrder) : 0,
      isActive: isActive === "false" ? false : true,
    },
  });
  return NextResponse.json(manufacturer, { status: 201 });
}
