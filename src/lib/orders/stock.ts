import { Prisma } from "@prisma/client";

/**
 * Stock is checked at checkout but was never actually decremented anywhere
 * in the codebase — this is the single place that changes, called from
 * every point an order becomes CONFIRMED (COD creation, Razorpay verify,
 * UPI admin verify) and mirrored by restockItems on cancellation.
 */
export interface StockLineItem {
  productId: string;
  variantId: string | null;
  quantity: number;
}

export class InsufficientStockError extends Error {
  constructor(public readonly productId: string, public readonly variantId: string | null) {
    super(`Insufficient stock for ${variantId ? `variant ${variantId}` : `product ${productId}`}`);
  }
}

/**
 * An item decrements whichever record it points at — the variant when
 * variantId is set, otherwise the product — never both. The guarded
 * `stock: { gte: quantity }` makes each update atomic against concurrent
 * orders; a failed guard throws so the caller's transaction rolls back
 * everything decremented so far, rather than leaving a partial decrement.
 */
export async function decrementStock(tx: Prisma.TransactionClient, items: StockLineItem[]): Promise<void> {
  for (const item of items) {
    if (item.variantId) {
      const result = await tx.productVariant.updateMany({
        where: { id: item.variantId, stock: { gte: item.quantity } },
        data: { stock: { decrement: item.quantity } },
      });
      if (result.count === 0) throw new InsufficientStockError(item.productId, item.variantId);
    } else {
      const result = await tx.product.updateMany({
        where: { id: item.productId, stock: { gte: item.quantity } },
        data: { stock: { decrement: item.quantity } },
      });
      if (result.count === 0) throw new InsufficientStockError(item.productId, null);
    }
  }
}

export async function restockItems(tx: Prisma.TransactionClient, items: StockLineItem[]): Promise<void> {
  for (const item of items) {
    if (item.variantId) {
      await tx.productVariant.update({
        where: { id: item.variantId },
        data: { stock: { increment: item.quantity } },
      });
    } else {
      await tx.product.update({
        where: { id: item.productId },
        data: { stock: { increment: item.quantity } },
      });
    }
  }
}
