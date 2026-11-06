import type { Prisma } from "@prisma/client";

/**
 * Shopper-facing category rules for the two-level Category tree.
 *
 * - Filtering by a top-level category also matches products filed under its subcategories.
 * - Category lists (chips, filters, GET /api/categories) only show categories a shopper can find
 *   something in: an active product of its own or in one of its active subcategories. Without this,
 *   the supplier catalogue (125 part types, mostly empty until vendors list) would flood the shop.
 *   The Java port (CatalogRepository.activeCategories) applies the same rule.
 */
export function productCategorySlugWhere(slug: string): Prisma.ProductWhereInput {
  return { category: { OR: [{ slug }, { parent: { slug } }] } };
}

export const BROWSABLE_CATEGORY_WHERE: Prisma.CategoryWhereInput = {
  isActive: true,
  OR: [
    { products: { some: { isActive: true } } },
    { children: { some: { isActive: true, products: { some: { isActive: true } } } } },
  ],
};
