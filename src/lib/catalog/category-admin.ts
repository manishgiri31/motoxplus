import { revalidateTag } from "next/cache";
import { NextResponse } from "next/server";
import { z } from "zod";
import { prisma } from "@/lib/prisma";
import { slugify } from "@/lib/utils";

/** Shared rules for the Admin -> Categories API (two levels: top-level groups and their subcategories). */

export const categoryCreateSchema = z.object({
  name: z.string().trim().min(2, "Name must be at least 2 characters").max(80),
  description: z.string().trim().max(500).optional(),
  parentId: z.string().min(1).nullable().optional(),
});

export const categoryUpdateSchema = z
  .object({
    name: z.string().trim().min(2, "Name must be at least 2 characters").max(80),
    description: z.string().trim().max(500).nullable(),
    isActive: z.boolean(),
    parentId: z.string().min(1).nullable(),
  })
  .partial();

export const categoryReorderSchema = z.object({
  parentId: z.string().min(1).nullable(),
  orderedIds: z.array(z.string().min(1)).min(1).max(500),
});

export function invalidateCategories() {
  // Storefront lists, the supplier catalogue tree and product pages all read under this tag.
  revalidateTag("categories");
  revalidateTag("products");
}

/** A unique slug: "brake-pads", then "brake-pads-2", … */
export async function uniqueCategorySlug(name: string, excludeId?: string): Promise<string> {
  const base = slugify(name.replace(/&/g, " and ")) || "category";
  for (let n = 1; n < 100; n++) {
    const slug = n === 1 ? base : `${base}-${n}`;
    const hit = await prisma.category.findUnique({ where: { slug }, select: { id: true } });
    if (!hit || hit.id === excludeId) return slug;
  }
  return `${base}-${Date.now()}`;
}

/** Checks that `parentId` can hold subcategories (exists, is top-level, isn't the category itself). */
export async function checkParent(parentId: string, selfId?: string): Promise<string | null> {
  if (parentId === selfId) return "A category cannot be its own parent";
  const parent = await prisma.category.findUnique({ where: { id: parentId }, select: { parentId: true } });
  if (!parent) return "Parent category not found";
  if (parent.parentId) return "Subcategories can only be added to a top-level category";
  return null;
}

export function badRequest(error: string, status = 400) {
  return NextResponse.json({ error }, { status });
}

export function isUniqueViolation(e: unknown): boolean {
  return typeof e === "object" && e !== null && (e as { code?: string }).code === "P2002";
}
