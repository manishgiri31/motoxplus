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
      const relevantStock = item.variant ? item.variant.stock : item.product.stock;
      const relevantActive = item.variant ? item.variant.isActive : true;
      const problem =
        !item.product.isActive || !relevantActive || relevantStock < item.quantity;
      console.log(JSON.stringify({
        product: item.product.name,
        productActive: item.product.isActive,
        variantId: item.variantId,
        variantLabel: item.variant?.label,
        variantActive: item.variant?.isActive,
        productStock: item.product.stock,
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
