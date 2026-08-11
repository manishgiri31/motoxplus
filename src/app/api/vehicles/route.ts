import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { checkIPRateLimit } from "@/lib/auth/rate-limit";
import { getClientIP } from "@/lib/auth/middleware";

export const revalidate = 86400; // 24h — matches the ~24h cache the mobile app was asked to use

// Public, read-only vehicle taxonomy for the mobile app's vehicle picker.
// Response shape is plain JSON (no envelope), matching GET /api/categories
// (see docs/api.md §1) — but reads the REAL vehicle-fitment tables
// (VehicleManufacturer -> Vehicle -> VehicleVariant, with VehicleVariant
// optionally grouped under a VehicleGeneration) that already back
// /api/admin/vehicles/* and the vehicle/variant filters on GET /api/products
// (see lib/vehicle/compatibility.ts) — not a separate/duplicate taxonomy.
export async function GET(req: NextRequest) {
  const ip = getClientIP(req);
  if (!(await checkIPRateLimit(ip, 60, 60))) {
    return NextResponse.json({ error: "Too many requests. Please try again later." }, { status: 429 });
  }

  const [manufacturers, latestVariant, latestVehicle, latestManufacturer] = await Promise.all([
    prisma.vehicleManufacturer.findMany({
      where: { isActive: true },
      orderBy: { sortOrder: "asc" },
      select: {
        id: true,
        name: true,
        slug: true,
        logo: true,
        vehicles: {
          where: { isActive: true },
          orderBy: { sortOrder: "asc" },
          select: {
            id: true,
            name: true,
            slug: true,
            category: true,
            heroImage: true,
            engineCc: true,
            yearFrom: true,
            yearTo: true,
            variants: {
              where: { isActive: true },
              orderBy: { sortOrder: "asc" },
              select: {
                id: true,
                slug: true,
                name: true,
                engineCc: true,
                yearFrom: true,
                yearTo: true,
                generation: { select: { name: true, yearFrom: true, yearTo: true } },
              },
            },
          },
        },
      },
    }),
    prisma.vehicleVariant.aggregate({ _max: { updatedAt: true } }),
    prisma.vehicle.aggregate({ _max: { updatedAt: true } }),
    prisma.vehicleManufacturer.aggregate({ _max: { updatedAt: true } }),
  ]);

  const updatedAt = new Date(
    Math.max(
      latestVariant._max.updatedAt?.getTime() ?? 0,
      latestVehicle._max.updatedAt?.getTime() ?? 0,
      latestManufacturer._max.updatedAt?.getTime() ?? 0
    )
  ).toISOString();
  const etag = `"${Buffer.from(updatedAt).toString("base64")}"`;

  if (req.headers.get("if-none-match") === etag) {
    return new NextResponse(null, { status: 304, headers: { ETag: etag } });
  }

  const brands = manufacturers.map((m) => ({
    id: m.id,
    name: m.name,
    slug: m.slug,
    logoUrl: m.logo,
    models: m.vehicles.map((v) => ({
      id: v.id,
      name: v.name,
      slug: v.slug,
      category: v.category,
      heroImage: v.heroImage,
      variants: v.variants.map((variant) => ({
        id: variant.id,
        slug: variant.slug,
        name: variant.name,
        generationName: variant.generation?.name ?? null,
        yearFrom: variant.yearFrom ?? variant.generation?.yearFrom ?? v.yearFrom ?? null,
        yearTo: variant.yearTo ?? variant.generation?.yearTo ?? v.yearTo ?? null,
        engineCc: variant.engineCc ?? v.engineCc ?? null,
      })),
    })),
  }));

  return NextResponse.json(
    { brands, updatedAt },
    {
      headers: {
        ETag: etag,
        "Cache-Control": "public, max-age=0, s-maxage=86400, stale-while-revalidate=3600",
      },
    }
  );
}
