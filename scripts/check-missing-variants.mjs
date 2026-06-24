import { PrismaClient } from "@prisma/client";
const prisma = new PrismaClient();

// Find deactivated visor products that are NOT in the master product variants
const deactivated = await prisma.product.findMany({
  where: {
    isActive: false,
    OR: [
      { name: { contains: "visor", mode: "insensitive" } },
      { name: { contains: "H/L VISOR", mode: "insensitive" } },
    ],
  },
  select: { id: true, name: true, partNumber: true, sku: true },
  orderBy: { partNumber: "asc" },
});

const master = await prisma.product.findFirst({ where: { sku: "MX-VISOR-MASTER" } });
const variants = await prisma.productVariant.findMany({
  where: { productId: master?.id },
  select: { partNumber: true },
});

const variantPartNumbers = new Set(variants.map(v => v.partNumber));
const missing = deactivated.filter(p => !variantPartNumbers.has(p.partNumber));

console.log(`Total deactivated visor products: ${deactivated.length}`);
console.log(`Total variants in master: ${variants.length}`);
console.log(`\nMissing from master (${missing.length}):`);
missing.forEach(p => console.log(`  ${p.partNumber} | ${p.name}`));

await prisma.$disconnect();
