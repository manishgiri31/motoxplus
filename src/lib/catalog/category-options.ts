import type { Prisma } from "@prisma/client";
import { prisma } from "@/lib/prisma";

/**
 * Categories for a product <select>, labelled "Group › Subcategory" so the 100+ part types stay
 * readable in one flat list, sorted by that label.
 */
export async function listCategoryOptions(where: Prisma.CategoryWhereInput = { isActive: true }) {
  const rows = await prisma.category.findMany({ where, include: { parent: { select: { name: true } } } });
  return rows
    .map(({ parent, ...c }) => ({ ...c, name: parent ? `${parent.name} › ${c.name}` : c.name }))
    .sort((a, b) => a.name.localeCompare(b.name));
}
