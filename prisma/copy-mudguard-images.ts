/**
 * For each variant in the master FRONT MUDGUARD product:
 *   1. Constructs the matching inactive product name:
 *      "FRONT MUDGUARD " + variant.label
 *   2. Finds that inactive product in the DB
 *   3. Copies its primary image URL onto variant.imageUrl
 *
 * After this runs, selecting a different model/color on the product page
 * will show that variant's own image instead of the master product image.
 *
 * Run: npm run db:copy-mudguard-images
 */

import { PrismaClient } from "@prisma/client";

const prisma = new PrismaClient();

async function main() {
  // Get master product + all its variants
  const master = await (prisma.product as any).findFirst({
    where: { sku: "MX-MUDGUARD" },
    include: {
      variants: {
        where: { isActive: true },
        orderBy: { sortOrder: "asc" },
      },
    },
  });

  if (!master) {
    console.error("Master product MX-MUDGUARD not found. Run db:seed-mudguard first.");
    process.exit(1);
  }

  console.log(`Master: "${master.name}" — ${master.variants.length} active variants\n`);

  let copied = 0;
  let noProduct = 0;
  let noImage = 0;

  for (const variant of master.variants) {
    // The inactive individual product has this exact name
    const searchName = `FRONT MUDGUARD ${variant.label}`;

    // Find it (case-insensitive for safety)
    const individual = await (prisma.product as any).findFirst({
      where: {
        name: { equals: searchName, mode: "insensitive" },
        isActive: false,
      },
      include: {
        productImages: {
          orderBy: [{ isPrimary: "desc" }, { sortOrder: "asc" }],
        },
      },
    });

    if (!individual) {
      // Try partial match — in case name has extra spaces / slight differences
      const individual2 = await (prisma.product as any).findFirst({
        where: {
          name: { contains: variant.label, mode: "insensitive" },
          isActive: false,
        },
        include: {
          productImages: {
            orderBy: [{ isPrimary: "desc" }, { sortOrder: "asc" }],
          },
        },
      });

      if (!individual2) {
        console.log(`  ? no product found for: "${variant.label}"`);
        noProduct++;
        continue;
      }

      // Use the partial match
      Object.assign(individual ?? {}, individual2);
      const imageUrl: string | null =
        individual2.productImages[0]?.imageUrl ??
        (individual2.images?.length > 0 ? individual2.images[0] : null);

      if (!imageUrl) {
        console.log(`  — no image: "${variant.label}"`);
        noImage++;
        continue;
      }

      await (prisma.productVariant as any).update({
        where: { id: variant.id },
        data: { imageUrl },
      });
      console.log(`  ✓ "${variant.label}"`);
      copied++;
      continue;
    }

    const imageUrl: string | null =
      individual.productImages[0]?.imageUrl ??
      (individual.images?.length > 0 ? individual.images[0] : null);

    if (!imageUrl) {
      console.log(`  — no image: "${variant.label}"`);
      noImage++;
      continue;
    }

    await (prisma.productVariant as any).update({
      where: { id: variant.id },
      data: { imageUrl },
    });
    console.log(`  ✓ "${variant.label}"`);
    copied++;
  }

  console.log(`\n─────────────────────────────────────`);
  console.log(`Copied   : ${copied} / ${master.variants.length} variants`);
  if (noProduct > 0) console.log(`No match : ${noProduct} (no inactive product with that name)`);
  if (noImage  > 0) console.log(`No image : ${noImage}  (product exists but has no photo)`);

  if (noProduct > 0) {
    console.log(`\nSample — showing first 5 variant labels to debug naming:`);
    for (const v of master.variants.slice(0, 5)) {
      console.log(`  label = "${v.label}"`);
    }
  }
}

main()
  .catch((err) => { console.error(err); process.exit(1); })
  .finally(() => prisma.$disconnect());
