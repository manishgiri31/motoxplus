import { unstable_cache } from "next/cache";
import { prisma } from "@/lib/prisma";
import {
  MAX_PART_CATEGORY_IDS,
  expandSelection,
  normalizeSelection,
  type PartCategoryGroup,
} from "./part-category-selection";
import { VEHICLE_SEGMENT_VALUES, type VehicleSegmentValue } from "./vehicle-segments";

/**
 * Server side of the automotive parts catalogue (see part-category-selection.ts for the model).
 *
 * The catalogue IS the product Category table: a top-level category that has at least one active
 * subcategory is a group, and its active subcategories are the options. Admins manage it under
 * Admin -> Categories, so nothing here is hard-coded.
 */

async function readTree(): Promise<PartCategoryGroup[]> {
  return prisma.category.findMany({
    where: { isActive: true, parentId: null, children: { some: { isActive: true } } },
    orderBy: [{ sortOrder: "asc" }, { name: "asc" }],
    select: {
      id: true,
      name: true,
      slug: true,
      children: {
        where: { isActive: true },
        orderBy: [{ sortOrder: "asc" }, { name: "asc" }],
        select: { id: true, name: true, slug: true },
      },
    },
  });
}

/** Cached for the public form; invalidated by revalidateTag("categories") from the admin routes. */
export const getPartCategoryTree = unstable_cache(readTree, ["part-category-tree-v1"], {
  revalidate: 300,
  tags: ["categories"],
});

export type PartCategoryValidation =
  | { ok: true; ids: string[] }
  | { ok: false; error: string };

/**
 * Validates ids sent by a client against the LIVE tree (never the cache, so a category an admin
 * just deactivated cannot be chosen) and returns them normalised.
 */
export async function validatePartCategoryIds(ids: string[]): Promise<PartCategoryValidation> {
  if (ids.length === 0) return { ok: false, error: "Select at least one automotive parts category" };
  if (ids.length > MAX_PART_CATEGORY_IDS) return { ok: false, error: "Too many categories selected" };

  const tree = await readTree();
  const known = new Set(tree.flatMap((g) => [g.id, ...g.children.map((c) => c.id)]));
  if (ids.some((id) => !known.has(id))) {
    return { ok: false, error: "One or more selected categories are no longer available. Refresh and try again." };
  }
  return { ok: true, ids: normalizeSelection(tree, ids) };
}

export type VendorSupplyValidation =
  | { ok: true; categoryIds: string[]; vehicleSegments: VehicleSegmentValue[] }
  | { ok: false; field: "categoryIds" | "vehicleSegments"; error: string };

/**
 * What a vendor supplies, as sent by an admin form: part category ids (validated against the live
 * tree, normalised) and vehicle segments (deduplicated, at least one).
 */
export async function validateVendorSupply(input: { categoryIds?: unknown; vehicleSegments?: unknown }): Promise<VendorSupplyValidation> {
  const ids = input.categoryIds;
  if (!Array.isArray(ids) || ids.some((id) => typeof id !== "string" || id.length === 0 || id.length > 64)) {
    return { ok: false, field: "categoryIds", error: "Select at least one automotive parts category" };
  }
  const segs = input.vehicleSegments;
  const allowed = new Set<string>(VEHICLE_SEGMENT_VALUES);
  if (!Array.isArray(segs) || segs.length === 0 || segs.some((s) => typeof s !== "string" || !allowed.has(s))) {
    return { ok: false, field: "vehicleSegments", error: "Select at least one vehicle segment" };
  }
  const categories = await validatePartCategoryIds(ids as string[]);
  if (!categories.ok) return { ok: false, field: "categoryIds", error: categories.error };
  return { ok: true, categoryIds: categories.ids, vehicleSegments: Array.from(new Set(segs as VehicleSegmentValue[])) };
}

/**
 * Category ids an approved vendor may list products under, or null when the vendor has no part
 * categories on record (vendors who applied before the catalogue existed keep listing anywhere).
 */
export async function getVendorListableCategoryIds(vendorId: string): Promise<Set<string> | null> {
  const links = await prisma.vendorPartCategory.findMany({ where: { vendorId }, select: { categoryId: true } });
  if (links.length === 0) return null;
  return expandSelection(await readTree(), links.map((l) => l.categoryId));
}
