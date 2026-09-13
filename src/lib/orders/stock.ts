import { Prisma } from "@prisma/client";

/**
 * Called from every point an order becomes CONFIRMED (COD creation, Razorpay
 * verify, UPI admin verify) and mirrored by restockItems on cancellation.
 *
 * Only variant-level items decrement/restock — ProductVariant.stock is still
 * a real counted quantity. A plain (non-variant) product no longer tracks a
 * countable number: its stockStatus is an admin-set three-state flag, not
 * inventory to debit on order placement, so those items are a no-op here.
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
 * The guarded `stock: { gte: quantity }` makes each update atomic against
 * concurrent orders; a failed guard throws so the caller's transaction rolls
 * back everything decremented so far, rather than leaving a partial decrement.
 */
export async function decrementStock(tx: Prisma.TransactionClient, items: StockLineItem[]): Promise<void> {
  for (const item of items) {
    if (!item.variantId) continue;
    const result = await tx.productVariant.updateMany({
      where: { id: item.variantId, stock: { gte: item.quantity } },
      data: { stock: { decrement: item.quantity } },
    });
    if (result.count === 0) throw new InsufficientStockError(item.productId, item.variantId);
  }
}

export async function restockItems(tx: Prisma.TransactionClient, items: StockLineItem[]): Promise<void> {
  for (const item of items) {
    if (!item.variantId) continue;
    await tx.productVariant.update({
      where: { id: item.variantId },
      data: { stock: { increment: item.quantity } },
    });
  }
}
