/**
 * Fills packageWeight (kg) and packageLength/Width/Height (cm) for products that have NO size data yet,
 * using one default per category. Products that already have any of these values (for example, entered
 * by a vendor) are never touched.
 *
 * Dry run by default:   npm run db:backfill-dimensions
 * Write to the DB:      npm run db:backfill-dimensions -- --apply
 *
 * The defaults below are estimates for the whole category. Replace them with measured values for the
 * big sellers as they are weighed. Categories with no entry here are skipped and reported.
 */
import { PrismaClient } from "@prisma/client";

const prisma = new PrismaClient();
const APPLY = process.argv.includes("--apply");

type Default = { packageWeight: number; packageLength: number; packageWidth: number; packageHeight: number };

// Category name -> default chargeable inputs (kg, cm). The box size is what volumetric weight uses.
const CATEGORY_DEFAULTS: Record<string, Default> = {
  "Body Parts": { packageWeight: 0.5, packageLength: 30, packageWidth: 20, packageHeight: 10 },
  "Electrical Parts": { packageWeight: 0.3, packageLength: 20, packageWidth: 15, packageHeight: 8 },
  "Engine Parts": { packageWeight: 1.5, packageLength: 30, packageWidth: 25, packageHeight: 20 },
  "Suspension Parts": { packageWeight: 3, packageLength: 80, packageWidth: 15, packageHeight: 15 },
  Cables: { packageWeight: 0.1, packageLength: 25, packageWidth: 5, packageHeight: 5 },
  "Head Light Visor": { packageWeight: 0.3, packageLength: 25, packageWidth: 20, packageHeight: 10 },
  "Transmission Parts": { packageWeight: 0.8, packageLength: 25, packageWidth: 20, packageHeight: 15 },
  "Brake Parts": { packageWeight: 0.4, packageLength: 20, packageWidth: 15, packageHeight: 10 },
  Mudguard: { packageWeight: 0.8, packageLength: 60, packageWidth: 30, packageHeight: 15 },
  "Clutch Plates": { packageWeight: 0.3, packageLength: 15, packageWidth: 15, packageHeight: 5 },
  "Ball Racer": { packageWeight: 0.1, packageLength: 10, packageWidth: 10, packageHeight: 5 },
  Indicators: { packageWeight: 0.2, packageLength: 15, packageWidth: 10, packageHeight: 8 },
  Bearings: { packageWeight: 0.1, packageLength: 10, packageWidth: 10, packageHeight: 5 },
  "Brake Shoes": { packageWeight: 0.2, packageLength: 15, packageWidth: 10, packageHeight: 5 },
  Horns: { packageWeight: 0.3, packageLength: 15, packageWidth: 10, packageHeight: 10 },
  "Halogen Bulbs": { packageWeight: 0.05, packageLength: 10, packageWidth: 8, packageHeight: 8 },
};

async function main() {
  const categories = await prisma.category.findMany({ select: { id: true, name: true } });

  const plan: Array<{ category: string; productsToFill: number; default: string }> = [];
  for (const cat of categories) {
    const value = CATEGORY_DEFAULTS[cat.name];
    const productsToFill = await prisma.product.count({
      where: {
        categoryId: cat.id,
        packageWeight: null,
        packageLength: null,
        packageWidth: null,
        packageHeight: null,
      },
    });
    plan.push({
      category: cat.name,
      productsToFill,
      default: value
        ? `${value.packageWeight} kg, ${value.packageLength}×${value.packageWidth}×${value.packageHeight} cm`
        : "NO DEFAULT, skipped",
    });
  }
  console.table(plan);

  const total = plan.reduce((n, p) => n + p.productsToFill, 0);
  if (!APPLY) {
    console.log(`Dry run. ${total} products would be filled. Re-run with -- --apply to write.`);
    return;
  }

  let written = 0;
  for (const cat of categories) {
    const value = CATEGORY_DEFAULTS[cat.name];
    if (!value) continue;
    const result = await prisma.product.updateMany({
      where: {
        categoryId: cat.id,
        packageWeight: null,
        packageLength: null,
        packageWidth: null,
        packageHeight: null,
      },
      data: value,
    });
    written += result.count;
    console.log(`${cat.name}: filled ${result.count}`);
  }
  console.log(`Done. Filled ${written} products.`);
}

main()
  .catch((err) => {
    console.error(err);
    process.exitCode = 1;
  })
  .finally(() => prisma.$disconnect());
