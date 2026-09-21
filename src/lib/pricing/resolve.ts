import type { OrderChannel } from "@prisma/client";

interface PriceableProduct {
  price: number;
  mrp: number | null;
}

interface PriceableVariant {
  price: number;
  mrp: number | null;
}

/**
 * Single place that resolves a line's unitPrice from a channel + product/
 * variant pair — the counterpart to lib/pricing/compute.ts's
 * computeOrderPricing (which takes unitPrice as already-resolved input).
 *
 * B2B: variant.price ?? product.price — the wholesale/dealer rate, exactly
 * today's inline `item.variant?.price ?? item.product.price` in
 * /api/orders and /api/cart.
 *
 * B2C: variant.mrp ?? product.mrp — GST-inclusive retail price. Returns null
 * (never falls back to the wholesale price) when neither is set, meaning the
 * product simply isn't orderable at retail yet — see lib/pricing/resolve.test.ts.
 */
export function resolveUnitPrice(params: {
  channel: OrderChannel;
  product: PriceableProduct;
  variant?: PriceableVariant | null;
}): number | null {
  const { channel, product, variant } = params;
  if (channel === "B2C") {
    return variant?.mrp ?? product.mrp ?? null;
  }
  return variant?.price ?? product.price;
}
