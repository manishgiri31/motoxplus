import { prisma } from "@/lib/prisma";
import { CompatibilityConfidence, CompatibilitySource, Prisma } from "@prisma/client";
import { buildVehicleCompatibilityWhere } from "@/lib/product-search";

/**
 * Central compatibility engine: resolves which products fit a given
 * vehicle/generation/variant/year/section combination.
 *
 * Hybrid by design — merges the structured `ProductCompatibility` matrix
 * with the legacy `Product.compatibility` string-array match (ILIKE against
 * vehicle name + aliases) so existing products keep working with zero
 * migration. Legacy matches are always tagged UNVERIFIED/LEGACY_STRING and
 * only apply when no section filter is active (legacy data has no section
 * granularity).
 */

export interface CompatibilityFilter {
  vehicleId: string;
  generationId?: string | null;
  variantId?: string | null;
  year?: number | null;
  sectionId?: string | null;
  emissionStandard?: string | null;
}

export interface FitmentInfo {
  confidence: CompatibilityConfidence;
  confidenceScore: number | null;
  source: CompatibilitySource;
  sectionId: string | null;
  position: string | null;
  fitmentNote: string | null;
}

export type CompatibleProduct = Prisma.ProductGetPayload<{
  include: {
    category: true;
    productImages: true;
  };
}> & { fitment: FitmentInfo };

const CONFIDENCE_RANK: Record<CompatibilityConfidence, number> = {
  VERIFIED: 3,
  LIKELY: 2,
  UNVERIFIED: 1,
  INCOMPATIBLE: -1,
};

function buildMatrixWhere(filter: CompatibilityFilter): Prisma.ProductCompatibilityWhereInput {
  const and: Prisma.ProductCompatibilityWhereInput[] = [
    { isActive: true },
    { vehicleId: filter.vehicleId },
    { NOT: { confidence: "INCOMPATIBLE" } },
  ];

  if (filter.generationId) {
    and.push({ OR: [{ generationId: null }, { generationId: filter.generationId }] });
  }
  if (filter.variantId) {
    and.push({ OR: [{ variantId: null }, { variantId: filter.variantId }] });
  }
  if (filter.sectionId) {
    and.push({ OR: [{ sectionId: null }, { sectionId: filter.sectionId }] });
  }
  if (filter.emissionStandard) {
    and.push({
      OR: [{ emissionStandard: null }, { emissionStandard: filter.emissionStandard as never }],
    });
  }
  if (filter.year) {
    and.push({ OR: [{ yearFrom: null }, { yearFrom: { lte: filter.year } }] });
    and.push({ OR: [{ yearTo: null }, { yearTo: { gte: filter.year } }] });
  }

  return { AND: and };
}

/**
 * Resolves the set of compatible product IDs for a filter, each tagged with
 * the highest-confidence fitment info found (matrix rows always outrank the
 * legacy string fallback).
 */
async function resolveCompatibleProductIds(
  filter: CompatibilityFilter
): Promise<Map<string, FitmentInfo>> {
  const matrixRows = await prisma.productCompatibility.findMany({
    where: buildMatrixWhere(filter),
  });

  const byProduct = new Map<string, FitmentInfo>();
  for (const row of matrixRows) {
    const existing = byProduct.get(row.productId);
    if (!existing || CONFIDENCE_RANK[row.confidence] > CONFIDENCE_RANK[existing.confidence]) {
      byProduct.set(row.productId, {
        confidence: row.confidence,
        confidenceScore: row.confidenceScore,
        source: row.source,
        sectionId: row.sectionId,
        position: row.position,
        fitmentNote: row.fitmentNote,
      });
    }
  }

  // Legacy free-text fallback has no section granularity, so only apply it
  // when the caller isn't filtering by section.
  if (!filter.sectionId) {
    const vehicle = await prisma.vehicle.findUnique({
      where: { id: filter.vehicleId },
      select: { name: true, searchAliases: true },
    });
    const terms = vehicle
      ? Array.from(new Set([vehicle.name, ...vehicle.searchAliases])).filter(Boolean)
      : [];

    if (terms.length > 0) {
      const legacyWhere = await buildVehicleCompatibilityWhere(terms, true);
      const legacyProducts = await prisma.product.findMany({
        where: legacyWhere,
        select: { id: true },
      });
      for (const p of legacyProducts) {
        if (!byProduct.has(p.id)) {
          byProduct.set(p.id, {
            confidence: "UNVERIFIED",
            confidenceScore: null,
            source: "LEGACY_STRING",
            sectionId: null,
            position: null,
            fitmentNote: null,
          });
        }
      }
    }
  }

  return byProduct;
}

export async function getCompatibleProductIds(filter: CompatibilityFilter): Promise<string[]> {
  const byProduct = await resolveCompatibleProductIds(filter);
  return Array.from(byProduct.keys());
}

export async function getCompatibleProducts(
  filter: CompatibilityFilter,
  opts: { take?: number; activeOnly?: boolean } = {}
): Promise<CompatibleProduct[]> {
  const { take, activeOnly = true } = opts;
  const byProduct = await resolveCompatibleProductIds(filter);
  const productIds = Array.from(byProduct.keys());
  if (productIds.length === 0) return [];

  const products = await prisma.product.findMany({
    where: {
      id: { in: productIds },
      ...(activeOnly ? { isActive: true } : {}),
    },
    include: {
      category: true,
      productImages: { orderBy: [{ isPrimary: "desc" }, { sortOrder: "asc" }], take: 1 },
    },
    take,
    orderBy: { createdAt: "desc" },
  });

  return products.map((p) => ({ ...p, fitment: byProduct.get(p.id)! }));
}

export async function getCompatibilityCount(
  filter: CompatibilityFilter,
  activeOnly = true
): Promise<number> {
  const byProduct = await resolveCompatibleProductIds(filter);
  const productIds = Array.from(byProduct.keys());
  if (productIds.length === 0) return 0;
  return prisma.product.count({
    where: { id: { in: productIds }, ...(activeOnly ? { isActive: true } : {}) },
  });
}

/**
 * Bike sections that have at least one active compatibility row for this
 * vehicle — powers the section-navigation UI (falls back to empty when the
 * vehicle only has legacy string-matched parts).
 */
export async function getVehicleSections(vehicleId: string) {
  const rows = await prisma.productCompatibility.findMany({
    where: { vehicleId, isActive: true, sectionId: { not: null } },
    select: { sectionId: true },
    distinct: ["sectionId"],
  });
  const sectionIds = rows.map((r) => r.sectionId).filter((id): id is string => Boolean(id));
  if (sectionIds.length === 0) return [];

  return prisma.vehiclePartSection.findMany({
    where: { id: { in: sectionIds }, isActive: true },
    orderBy: { sortOrder: "asc" },
  });
}
