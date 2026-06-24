import { prisma } from "@/lib/prisma";
import { Prisma } from "@prisma/client";

/**
 * Get product IDs where any element in the `compatibility` string[]
 * partially matches the search term (case-insensitive).
 * Prisma has no built-in partial-match on arrays, so we use raw SQL.
 */
async function compatibilityMatchIds(search: string, activeOnly: boolean): Promise<string[]> {
  const pattern = `%${search}%`;
  const rows = activeOnly
    ? await prisma.$queryRaw<{ id: string }[]>`
        SELECT id FROM "Product"
        WHERE "isActive" = true
          AND EXISTS (
            SELECT 1 FROM unnest(compatibility) AS c
            WHERE c ILIKE ${pattern}
          )`
    : await prisma.$queryRaw<{ id: string }[]>`
        SELECT id FROM "Product"
        WHERE EXISTS (
          SELECT 1 FROM unnest(compatibility) AS c
          WHERE c ILIKE ${pattern}
        )`;
  return rows.map((r) => r.id);
}

export async function buildSearchWhere(
  search: string,
  activeOnly = true
): Promise<Prisma.ProductWhereInput> {
  const compatIds = await compatibilityMatchIds(search, activeOnly);

  const orConditions: Prisma.ProductWhereInput[] = [
    { name: { contains: search, mode: "insensitive" } },
    { partNumber: { contains: search, mode: "insensitive" } },
    { sku: { contains: search, mode: "insensitive" } },
    { brand: { contains: search, mode: "insensitive" } },
    { description: { contains: search, mode: "insensitive" } },
    { oemNumber: { contains: search, mode: "insensitive" } },
  ];

  if (compatIds.length > 0) {
    orConditions.push({ id: { in: compatIds } });
  }

  return { OR: orConditions };
}
