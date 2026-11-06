import { unstable_cache } from "next/cache";
import { prisma } from "@/lib/prisma";
import {
  MAX_PART_CATEGORY_IDS,
  expandSelection,
  normalizeSelection,
  type PartCategoryGroup,
} from "./part-category-selection";

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

/**
 * Category ids an approved vendor may list products under, or null when the vendor has no part
 * categories on record (vendors who applied before the catalogue existed keep listing anywhere).
 */
export async function getVendorListableCategoryIds(vendorId: string): Promise<Set<string> | null> {
  const links = await prisma.vendorPartCategory.findMany({ where: { vendorId }, select: { categoryId: true } });
  if (links.length === 0) return null;
  return expandSelection(await readTree(), links.map((l) => l.categoryId));
}
