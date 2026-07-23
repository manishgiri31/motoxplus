import { prisma } from "@/lib/prisma";

/**
 * Lowercase, hyphen-separated, alphanumeric-only. Mirrors the SQL used in the
 * `add_product_slug` migration's backfill so app-generated and migration-generated
 * slugs are byte-for-byte consistent.
 */
export function slugify(input: string): string {
  return input
    .toLowerCase()
    .trim()
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-+|-+$/g, "");
}

/**
 * Generates a unique product slug from a name, excluding `excludeId` (used
 * when re-slugging an existing product on update) from the collision check.
 * Falls back to appending the numeric attempt count, e.g. `mudguard-2`.
 */
export async function uniqueProductSlug(name: string, excludeId?: string): Promise<string> {
  const base = slugify(name) || "product";
  let candidate = base;
  let attempt = 1;

  while (
    await prisma.product.findFirst({
      where: { slug: candidate, ...(excludeId ? { id: { not: excludeId } } : {}) },
      select: { id: true },
    })
  ) {
    attempt += 1;
    candidate = `${base}-${attempt}`;
  }

  return candidate;
}
