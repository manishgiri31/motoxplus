import { NextRequest, NextResponse } from "next/server";
import { requireAdmin } from "@/lib/auth/require-admin";
import { prisma } from "@/lib/prisma";

export async function GET() {
  if (!(await requireAdmin())) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const sections = await prisma.vehiclePartSection.findMany({
    orderBy: [{ sortOrder: "asc" }, { name: "asc" }],
  });
  return NextResponse.json(sections);
}

export async function POST(req: NextRequest) {
  if (!(await requireAdmin())) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const body = await req.json();
  const { name, slug, icon, description, sortOrder, isActive } = body;
  if (!name?.trim() || !slug?.trim()) {
    return NextResponse.json({ error: "name and slug are required" }, { status: 400 });
  }

  const section = await prisma.vehiclePartSection.create({
    data: {
      name: name.trim(),
      slug: slug.trim().toLowerCase(),
      icon: icon?.trim() || null,
      description: description?.trim() || null,
      sortOrder: sortOrder ? parseInt(sortOrder) : 0,
      isActive: isActive === "false" ? false : true,
    },
  });
  return NextResponse.json(section, { status: 201 });
}
