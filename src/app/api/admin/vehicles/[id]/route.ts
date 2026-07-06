import { NextRequest, NextResponse } from "next/server";
import { requireAdmin } from "@/lib/auth/require-admin";
import { prisma } from "@/lib/prisma";

function toStringArray(v: unknown): string[] | undefined {
  if (v === undefined) return undefined;
  if (Array.isArray(v)) return v.map(String).map((s) => s.trim()).filter(Boolean);
  if (typeof v === "string") return v.split(",").map((s) => s.trim()).filter(Boolean);
  return [];
}

export async function GET(_req: NextRequest, { params }: { params: { id: string } }) {
  if (!(await requireAdmin())) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const vehicle = await prisma.vehicle.findUnique({
    where: { id: params.id },
    include: {
      manufacturer: true,
      generations: { orderBy: { sortOrder: "asc" } },
      variants: { orderBy: { sortOrder: "asc" } },
      colors: { orderBy: { sortOrder: "asc" }, include: { oemColor: true } },
      gallery: { orderBy: { sortOrder: "asc" } },
      diagrams: { orderBy: { sortOrder: "asc" }, include: { hotspots: { orderBy: { sortOrder: "asc" } } } },
      model3d: { orderBy: { sortOrder: "asc" } },
      spins: { orderBy: { sortOrder: "asc" } },
      vinPatterns: true,
    },
  });
  if (!vehicle) return NextResponse.json({ error: "Not found" }, { status: 404 });
  return NextResponse.json(vehicle);
}

export async function PATCH(req: NextRequest, { params }: { params: { id: string } }) {
  if (!(await requireAdmin())) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const body = await req.json();
  const data: Record<string, unknown> = {};

  const strFields = ["heroImage", "power", "torque", "mileage", "weight", "fuelTank", "modelUrl", "badgeText"] as const;
  for (const k of strFields) if (body[k] !== undefined) data[k] = body[k]?.trim() || null;

  if (body.name !== undefined) data.name = body.name.trim();
  if (body.slug !== undefined) data.slug = body.slug.trim().toLowerCase();
  if (body.category !== undefined) data.category = body.category;
  if (body.manufacturerId !== undefined) data.manufacturerId = body.manufacturerId;
  if (body.engineCc !== undefined) data.engineCc = body.engineCc ? parseFloat(body.engineCc) : null;
  if (body.launchYear !== undefined) data.launchYear = body.launchYear ? parseInt(body.launchYear) : null;
  if (body.yearFrom !== undefined) data.yearFrom = body.yearFrom ? parseInt(body.yearFrom) : null;
  if (body.yearTo !== undefined) data.yearTo = body.yearTo ? parseInt(body.yearTo) : null;
  if (body.sortOrder !== undefined) data.sortOrder = parseInt(body.sortOrder) || 0;
  if (body.isActive !== undefined) data.isActive = body.isActive === true || body.isActive === "true";

  const searchAliases = toStringArray(body.searchAliases);
  if (searchAliases !== undefined) data.searchAliases = searchAliases;
  const ocrKeywords = toStringArray(body.ocrKeywords);
  if (ocrKeywords !== undefined) data.ocrKeywords = ocrKeywords;
  const aiLabels = toStringArray(body.aiLabels);
  if (aiLabels !== undefined) data.aiLabels = aiLabels;

  const vehicle = await prisma.vehicle.update({ where: { id: params.id }, data });
  return NextResponse.json(vehicle);
}

export async function DELETE(_req: NextRequest, { params }: { params: { id: string } }) {
  if (!(await requireAdmin())) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  await prisma.vehicle.delete({ where: { id: params.id } });
  return NextResponse.json({ success: true });
}
