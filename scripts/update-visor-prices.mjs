import { PrismaClient } from "@prisma/client";
const prisma = new PrismaClient();

const MASTER_SKU = "MX-VISOR-MASTER";
const DISCOUNT = 0.30; // dealer pays 30% of MRP = 70% off

async function main() {
  const product = await prisma.product.findFirst({
    where: { sku: MASTER_SKU },
    include: { variants: { where: { isActive: true } } },
  });

  if (!product) {
    console.error("Master product not found (SKU:", MASTER_SKU, ")");
    process.exit(1);
  }

  console.log(`Product: ${product.name} | MRP: ₹${product.mrp} | Current price: ₹${product.price}`);
  console.log(`Variants to update: ${product.variants.length}`);

  let updated = 0;
  for (const v of product.variants) {
    const mrp = v.mrp ?? product.mrp ?? 750;
    const newPrice = Math.round(mrp * DISCOUNT * 100) / 100;
    await prisma.productVariant.update({
      where: { id: v.id },
      data: { price: newPrice },
    });
    updated++;
    if (updated % 50 === 0) console.log(`  ${updated}/${product.variants.length} done…`);
  }

  const productMrp = product.mrp ?? 750;
  const newProductPrice = Math.round(productMrp * DISCOUNT * 100) / 100;
  await prisma.product.update({
    where: { id: product.id },
    data: { price: newProductPrice },
  });

  console.log(`\nDone! Updated ${updated} variants.`);
  console.log(`Master product price: ₹${product.price} → ₹${newProductPrice} (70% off ₹${productMrp})`);
}

main().catch(console.error).finally(() => prisma.$disconnect());
