import { roundToPaise } from "@/lib/utils";
import type { OrderChannel } from "@prisma/client";

/**
 * One resolved cart/order line. unitPrice is whatever the caller already
 * resolved (variant?.price ?? product.price for B2B today) — this module
 * doesn't touch price resolution, only the tax/rounding arithmetic that
 * turns a line into subtotal + GST + total.
 */
export interface PricingItemInput {
  productId: string;
  variantId?: string | null;
  variantLabel?: string | null;
  variantSku?: string | null;
  quantity: number;
  unitPrice: number;
  gstRate: number;
}

export interface PricingLine {
  productId: string;
  variantId: string | null;
  variantLabel: string | null;
  variantSku: string | null;
  quantity: number;
  unitPrice: number;
  gstRate: number;
  gstAmount: number;
  total: number;
}

export interface OrderPricing {
  subtotal: number;
  gstAmount: number;
  lines: PricingLine[];
}

/**
 * B2B dealer pricing (the only strategy that has ever existed — extracted
 * verbatim from the inline logic in /api/orders/route.ts, with one
 * deliberate fix, see below).
 *
 * Each line's gstAmount/total is rounded independently (roundToPaise), and
 * the order-level subtotal/gstAmount are derived by summing those
 * already-rounded lines — not from a separately-accumulated raw sum.
 *
 * Fixed 2026-09-18 (B2C-EXPANSION-PLAN.md Phase 0): the previous
 * /api/orders logic accumulated raw (unrounded) unitPrice*quantity*gstRate/100
 * across all lines and rounded that sum once at the end, in a codepath
 * entirely separate from the one that built each OrderItem's own rounded
 * gstAmount/total. Those two roundings of the same underlying number don't
 * always agree — classic penny-rounding drift — so Order.gstAmount could be
 * a paisa or two off from Σ OrderItem.gstAmount, i.e. an invoice whose
 * printed line amounts don't sum to its own printed total. Deriving the
 * order-level totals from the lines array instead guarantees they always
 * reconcile. The golden test's Fixture D pins a concrete case where the two
 * approaches diverge, with the old (wrong) value in a comment for reference.
 */
function computeB2BPricing(items: PricingItemInput[]): OrderPricing {
  const lines: PricingLine[] = items.map((item) => {
    const lineSubtotal = item.unitPrice * item.quantity;
    const gstAmount = roundToPaise((lineSubtotal * item.gstRate) / 100);
    const total = roundToPaise(lineSubtotal + gstAmount);
    return {
      productId: item.productId,
      variantId: item.variantId ?? null,
      variantLabel: item.variantLabel ?? null,
      variantSku: item.variantSku ?? null,
      quantity: item.quantity,
      unitPrice: item.unitPrice,
      gstRate: item.gstRate,
      gstAmount,
      total,
    };
  });

  const subtotal = roundToPaise(lines.reduce((sum, l) => sum + l.unitPrice * l.quantity, 0));
  const gstAmount = roundToPaise(lines.reduce((sum, l) => sum + l.gstAmount, 0));

  return { subtotal, gstAmount, lines };
}

/**
 * B2C retail pricing. No B2C catalogue/checkout page calls this yet (B2C
 * customer auth + catalogue are a later phase) — this is the pricing rule
 * ready for when one does, kept here rather than scattered across UI
 * components per the channel-seam design (B2C-EXPANSION-PLAN.md Phase 0).
 *
 * Unlike B2B, item.unitPrice here is Product.mrp — GST-INCLUSIVE, the one
 * number a retail customer sees (no separate GST line in that UI). The tax
 * is reverse-calculated out of that inclusive price rather than added on
 * top, because gstAmount/subtotal must still mean the same thing on both
 * channels: the invoice PDF needs a real CGST/SGST/IGST break-up (see
 * lib/tax/gst-split.ts) even though the B2C UI never shows one.
 *
 * Same reconciliation discipline as B2B: each line's gstAmount is rounded
 * independently, and order-level subtotal/gstAmount are derived by summing
 * the already-rounded lines.
 */
function computeB2CPricing(items: PricingItemInput[]): OrderPricing {
  const lines: PricingLine[] = items.map((item) => {
    const lineInclusive = roundToPaise(item.unitPrice * item.quantity);
    const lineTaxable = roundToPaise(lineInclusive / (1 + item.gstRate / 100));
    const gstAmount = roundToPaise(lineInclusive - lineTaxable);
    return {
      productId: item.productId,
      variantId: item.variantId ?? null,
      variantLabel: item.variantLabel ?? null,
      variantSku: item.variantSku ?? null,
      quantity: item.quantity,
      unitPrice: item.unitPrice,
      gstRate: item.gstRate,
      gstAmount,
      total: lineInclusive,
    };
  });

  const subtotal = roundToPaise(lines.reduce((sum, l) => sum + (l.total - l.gstAmount), 0));
  const gstAmount = roundToPaise(lines.reduce((sum, l) => sum + l.gstAmount, 0));

  return { subtotal, gstAmount, lines };
}

/**
 * Channel-aware entry point (B2C-EXPANSION-PLAN.md Phase 0 — the channel
 * seam).
 */
export function computeOrderPricing(params: {
  channel: OrderChannel;
  items: PricingItemInput[];
}): OrderPricing {
  if (params.channel === "B2C") {
    return computeB2CPricing(params.items);
  }
  return computeB2BPricing(params.items);
}
