import { NextRequest, NextResponse } from "next/server";
import { requireAdmin } from "@/lib/auth/require-admin";
import { prisma } from "@/lib/prisma";

function toStringArray(v: unknown): string[] {
  if (Array.isArray(v)) return v.map(String).map((s) => s.trim()).filter(Boolean);
  if (typeof v === "string") return v.split(",").map((s) => s.trim()).filter(Boolean);
  return [];
}

export async function GET(req: NextRequest) {
  if (!(await requireAdmin())) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const { searchParams } = new URL(req.url);
  const search = searchParams.get("search")?.trim();
  const manufacturerId = searchParams.get("manufacturerId") ?? undefined;
  const category = searchParams.get("category") ?? undefined;

  const vehicles = await prisma.vehicle.findMany({
    where: {
      ...(search ? { name: { contains: search, mode: "insensitive" } } : {}),
      ...(manufacturerId ? { manufacturerId } : {}),
      ...(category ? { category: category as never } : {}),
    },
    include: {
      manufacturer: { select: { name: true, logo: true } },
      _count: { select: { generations: true, variants: true, colors: true, diagrams: true, compatibilities: true } },
    },
    orderBy: [{ sortOrder: "asc" }, { name: "asc" }],
  });
  return NextResponse.json(vehicles);
}

export async function POST(req: NextRequest) {
  if (!(await requireAdmin())) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const body = await req.json();
  const { name, slug, category, manufacturerId } = body;
  if (!name?.trim() || !slug?.trim() || !category || !manufacturerId) {
    return NextResponse.json({ error: "name, slug, category and manufacturerId are required" }, { status: 400 });
  }

  const vehicle = await prisma.vehicle.create({
    data: {
      name: name.trim(),
      slug: slug.trim().toLowerCase(),
      category,
      manufacturerId,
      engineCc: body.engineCc ? parseFloat(body.engineCc) : null,
      launchYear: body.launchYear ? parseInt(body.launchYear) : null,
      yearFrom: body.yearFrom ? parseInt(body.yearFrom) : null,
      yearTo: body.yearTo ? parseInt(body.yearTo) : null,
      heroImage: body.heroImage?.trim() || null,
      power: body.power?.trim() || null,
      torque: body.torque?.trim() || null,
      mileage: body.mileage?.trim() || null,
      weight: body.weight?.trim() || null,
      fuelTank: body.fuelTank?.trim() || null,
      modelUrl: body.modelUrl?.trim() || null,
      badgeText: body.badgeText?.trim() || null,
      searchAliases: toStringArray(body.searchAliases),
      ocrKeywords: toStringArray(body.ocrKeywords),
      aiLabels: toStringArray(body.aiLabels),
      sortOrder: body.sortOrder ? parseInt(body.sortOrder) : 0,
      isActive: body.isActive === false || body.isActive === "false" ? false : true,
    },
  });
  return NextResponse.json(vehicle, { status: 201 });
}
