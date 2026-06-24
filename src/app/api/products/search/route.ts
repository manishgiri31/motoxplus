import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";

export async function GET(req: NextRequest) {
  const { searchParams } = new URL(req.url);
  const q = searchParams.get("q")?.trim();

  if (!q || q.length < 2) {
    return NextResponse.json({ suggestions: [] });
  }

  const pattern = `%${q}%`;

  // Fast parallel lookups for autocomplete — name/partNumber/sku in Prisma,
  // compatibility via raw SQL
  const [byFields, byCompatibility] = await Promise.all([
    prisma.product.findMany({
      where: {
        isActive: true,
        OR: [
          { name: { contains: q, mode: "insensitive" } },
          { partNumber: { contains: q, mode: "insensitive" } },
          { brand: { contains: q, mode: "insensitive" } },
          { sku: { contains: q, mode: "insensitive" } },
        ],
      },
      select: {
        id: true,
        name: true,
        partNumber: true,
        brand: true,
        category: { select: { name: true } },
        productImages: {
          where: { isPrimary: true },
          select: { imageUrl: true },
          take: 1,
        },
      },
      take: 8,
      orderBy: { name: "asc" },
    }),
    prisma.$queryRaw<{ id: string; name: string; partNumber: string; brand: string; categoryName: string }[]>`
      SELECT p.id, p.name, p."partNumber", p.brand,
             c.name AS "categoryName"
      FROM "Product" p
      JOIN "Category" c ON c.id = p."categoryId"
      WHERE p."isActive" = true
        AND EXISTS (
          SELECT 1 FROM unnest(p.compatibility) AS compat
          WHERE compat ILIKE ${pattern}
        )
      ORDER BY p.name ASC
      LIMIT 5
    `,
  ]);

  // Merge, deduplicate by id
  const seen = new Set<string>();
  const suggestions: {
    id: string;
    name: string;
    partNumber: string;
    brand: string;
    categoryName: string;
    imageUrl?: string;
    matchType: "name" | "partNumber" | "compatibility" | "brand";
  }[] = [];

  for (const p of byFields) {
    if (seen.has(p.id)) continue;
    seen.add(p.id);
    const nameLower = p.name.toLowerCase();
    const qLower = q.toLowerCase();
    const matchType =
      nameLower.includes(qLower) ? "name"
      : p.partNumber.toLowerCase().includes(qLower) ? "partNumber"
      : "brand";
    suggestions.push({
      id: p.id,
      name: p.name,
      partNumber: p.partNumber,
      brand: p.brand,
      categoryName: p.category.name,
      imageUrl: p.productImages[0]?.imageUrl,
      matchType,
    });
  }

  for (const p of byCompatibility) {
    if (seen.has(p.id)) continue;
    seen.add(p.id);
    suggestions.push({
      id: p.id,
      name: p.name,
      partNumber: p.partNumber,
      brand: p.brand,
      categoryName: p.categoryName,
      matchType: "compatibility",
    });
  }

  return NextResponse.json({ suggestions: suggestions.slice(0, 8) });
}
