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

/**
 * Matrix-aware match: finds products linked (via ProductCompatibility) to a
 * Vehicle or VehicleVariant whose name matches the search term. Runs
 * alongside the legacy ILIKE compatibility match so structured fitments are
 * searchable too.
 */
async function compatibilityMatrixMatchIds(search: string, activeOnly: boolean): Promise<string[]> {
  const rows = await prisma.productCompatibility.findMany({
    where: {
      isActive: true,
      ...(activeOnly ? { product: { isActive: true } } : {}),
      OR: [
        { vehicle: { name: { contains: search, mode: "insensitive" } } },
        { vehicle: { searchAliases: { has: search } } },
        { variant: { name: { contains: search, mode: "insensitive" } } },
      ],
    },
    select: { productId: true },
  });
  return rows.map((r) => r.productId);
}

export async function buildSearchWhere(
  search: string,
  activeOnly = true
): Promise<Prisma.ProductWhereInput> {
  const [compatIds, matrixIds] = await Promise.all([
    compatibilityMatchIds(search, activeOnly),
    compatibilityMatrixMatchIds(search, activeOnly),
  ]);

  const orConditions: Prisma.ProductWhereInput[] = [
    { name: { contains: search, mode: "insensitive" } },
    { partNumber: { contains: search, mode: "insensitive" } },
    { sku: { contains: search, mode: "insensitive" } },
    { brand: { contains: search, mode: "insensitive" } },
    { description: { contains: search, mode: "insensitive" } },
    { oemNumber: { contains: search, mode: "insensitive" } },
  ];

  const matchedIds = Array.from(new Set([...compatIds, ...matrixIds]));
  if (matchedIds.length > 0) {
    orConditions.push({ id: { in: matchedIds } });
  }

  return { OR: orConditions };
}

/**
 * Matches Product.compatibility[] against any of several vehicle aliases
 * (e.g. a vehicle's name plus its searchAliases). Used to filter parts by
 * selected vehicle rather than a free-text query.
 */
async function compatibilityMatchIdsMulti(
  terms: string[],
  activeOnly: boolean
): Promise<string[]> {
  const patterns = terms.map((t) => `%${t}%`);
  if (patterns.length === 0) return [];

  const rows = activeOnly
    ? await prisma.$queryRaw<{ id: string }[]>`
        SELECT id FROM "Product"
        WHERE "isActive" = true
          AND EXISTS (
            SELECT 1 FROM unnest(compatibility) AS c
            WHERE c ILIKE ANY(${patterns})
          )`
    : await prisma.$queryRaw<{ id: string }[]>`
        SELECT id FROM "Product"
        WHERE EXISTS (
          SELECT 1 FROM unnest(compatibility) AS c
          WHERE c ILIKE ANY(${patterns})
        )`;
  return rows.map((r) => r.id);
}

export async function buildVehicleCompatibilityWhere(
  terms: string[],
  activeOnly = true
): Promise<Prisma.ProductWhereInput> {
  const compatIds = await compatibilityMatchIdsMulti(terms, activeOnly);
  return { id: { in: compatIds } };
}

/**
 * Smart search: a single query can resolve to a vehicle/variant suggestion
 * (e.g. "splendor bs6 self start") as well as directly-matching parts.
 * Vehicle/variant matches are resolved to compatible products through the
 * central compatibility engine (dynamically imported to avoid a static
 * circular dependency, since that engine itself calls back into this file).
 */
export async function vehicleSmartSearch(query: string, opts: { take?: number } = {}) {
  const search = query.trim();
  if (!search) return { vehicles: [], variants: [], products: [] };

  const [vehicles, variants] = await Promise.all([
    prisma.vehicle.findMany({
      where: {
        isActive: true,
        OR: [
          { name: { contains: search, mode: "insensitive" } },
          { slug: { contains: search, mode: "insensitive" } },
          { searchAliases: { has: search } },
          { ocrKeywords: { has: search } },
        ],
      },
      include: { manufacturer: { select: { name: true, logo: true } } },
      take: 10,
    }),
    prisma.vehicleVariant.findMany({
      where: {
        isActive: true,
        OR: [{ name: { contains: search, mode: "insensitive" } }, { slug: { contains: search, mode: "insensitive" } }],
      },
      include: { vehicle: { select: { id: true, name: true, slug: true, category: true } } },
      take: 10,
    }),
  ]);

  const { getCompatibleProducts } = await import("@/lib/vehicle/compatibility");

  const vehicleIds = Array.from(
    new Set([...vehicles.map((v) => v.id), ...variants.map((v) => v.vehicleId)])
  );

  const productLists = await Promise.all(
    vehicleIds.map((vehicleId) =>
      getCompatibleProducts({ vehicleId }, { take: opts.take ?? 12 })
    )
  );

  const productsById = new Map<string, (typeof productLists)[number][number]>();
  for (const list of productLists) {
    for (const product of list) {
      if (!productsById.has(product.id)) productsById.set(product.id, product);
    }
  }

  return {
    vehicles,
    variants,
    products: Array.from(productsById.values()),
  };
}
