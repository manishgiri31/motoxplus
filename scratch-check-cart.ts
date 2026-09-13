import { PrismaClient } from "@prisma/client";

const prisma = new PrismaClient();

async function main() {
  const carts = await prisma.cart.findMany({
    include: {
      dealer: { include: { user: true } },
      items: { include: { product: true, variant: true } },
    },
  });

  console.log(`Total carts: ${carts.length}, with items: ${carts.filter(c => c.items.length > 0).length}`);

  for (const cart of carts) {
    if (cart.items.length === 0) continue;
    console.log(`\nDealer: ${cart.dealer?.user?.email ?? cart.dealerId}`);
    for (const item of cart.items) {
      const relevantActive = item.variant ? item.variant.isActive : true;
      const outOfStock = item.variant ? item.variant.stock < item.quantity : item.product.stockStatus === "OUT_OF_STOCK";
      const problem = !item.product.isActive || !relevantActive || outOfStock;
      console.log(JSON.stringify({
        product: item.product.name,
        productActive: item.product.isActive,
        variantId: item.variantId,
        variantLabel: item.variant?.label,
        variantActive: item.variant?.isActive,
        productStockStatus: item.product.stockStatus,
        variantStock: item.variant?.stock,
        requestedQty: item.quantity,
        FLAGGED_UNAVAILABLE: problem,
      }));
    }
  }
}

main()
  .catch(console.error)
  .finally(() => prisma.$disconnect());
