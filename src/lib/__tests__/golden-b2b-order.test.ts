import { describe, it, expect } from "vitest";
import { computeOrderPricing } from "@/lib/pricing/compute";
import { computeShippingQuote } from "@/lib/shipping/quote";
import { roundToPaise } from "@/lib/utils";

/**
 * Golden/snapshot test for the B2B order-creation pipeline
 * (B2C-EXPANSION-PLAN.md Phase 0 — the channel seam). Every fixture's
 * expected numbers are pinned as LITERALS below, not re-derived from the
 * same formulas being tested — if a future change alters any arithmetic,
 * this test must fail loudly, not silently agree with itself because it
 * recomputed the "expected" value the same (now different) way.
 *
 * If this test ever needs to change, that means B2B behavior changed —
 * stop and confirm with a human before touching an assertion here.
 *
 * Fixtures A/B/C exercise pure structural extraction: the OLD inline logic
 * in /api/orders/route.ts (before Phase 0) and the NEW lib functions below
 * produce byte-identical output for these — verified by hand via a
 * throwaway script before this file was written. Fixture D is the one
 * deliberate exception: it pins the 2026-09-18 rounding-order fix (see
 * lib/pricing/compute.ts's doc comment) and records what the old, now-wrong
 * value used to be, so the fix stays visible instead of quietly existing.
 */

function amountDue(paymentType: "ADVANCE_20" | "FULL_100", grandTotal: number): number {
  return roundToPaise(paymentType === "ADVANCE_20" ? grandTotal * 0.2 : grandTotal);
}

describe("golden B2B order — pricing + shipping", () => {
  it("Fixture A — multi-item, mixed GST rates, MOQ-qty, below the free-shipping threshold, 20% advance", () => {
    const pricing = computeOrderPricing({
      channel: "B2B",
      items: [
        // qty 10 respects this product's moq of 5 (MOQ itself is enforced
        // upstream at /api/cart, not by pricing — included here only to
        // keep the fixture a realistic dealer cart).
        { productId: "p1", variantId: null, variantLabel: null, variantSku: null, quantity: 10, unitPrice: 545.5, gstRate: 18 },
        { productId: "p2", variantId: "v1", variantLabel: "Red", variantSku: "SKU-V1", quantity: 3, unitPrice: 1275.25, gstRate: 28 },
        { productId: "p3", variantId: null, variantLabel: null, variantSku: null, quantity: 20, unitPrice: 212.4, gstRate: 5 },
      ],
    });

    expect(pricing.subtotal).toBe(13528.75);
    expect(pricing.gstAmount).toBe(2265.51);
    expect(pricing.lines).toEqual([
      { productId: "p1", variantId: null, variantLabel: null, variantSku: null, quantity: 10, unitPrice: 545.5, gstRate: 18, gstAmount: 981.9, total: 6436.9 },
      { productId: "p2", variantId: "v1", variantLabel: "Red", variantSku: "SKU-V1", quantity: 3, unitPrice: 1275.25, gstRate: 28, gstAmount: 1071.21, total: 4896.96 },
      { productId: "p3", variantId: null, variantLabel: null, variantSku: null, quantity: 20, unitPrice: 212.4, gstRate: 5, gstAmount: 212.4, total: 4460.4 },
    ]);

    const orderTotal = roundToPaise(pricing.subtotal + pricing.gstAmount);
    expect(orderTotal).toBe(15794.26);

    const shipping = computeShippingQuote({ channel: "B2B", orderTotal });
    expect(shipping.shippingCost).toBe(789.71); // below ₹25,000 → 5% charged

    const grandTotal = roundToPaise(orderTotal + shipping.shippingCost);
    expect(grandTotal).toBe(16583.97);
    expect(amountDue("ADVANCE_20", grandTotal)).toBe(3316.79);
  });

  it("Fixture B — bigger quantities, crosses the free-shipping threshold, full payment", () => {
    const pricing = computeOrderPricing({
      channel: "B2B",
      items: [
        { productId: "p1", variantId: null, variantLabel: null, variantSku: null, quantity: 25, unitPrice: 545.5, gstRate: 18 },
        { productId: "p2", variantId: "v1", variantLabel: "Red", variantSku: "SKU-V1", quantity: 8, unitPrice: 1275.25, gstRate: 28 },
        { productId: "p3", variantId: null, variantLabel: null, variantSku: null, quantity: 20, unitPrice: 212.4, gstRate: 5 },
      ],
    });

    expect(pricing.subtotal).toBe(28087.5);
    expect(pricing.gstAmount).toBe(5523.71);
    expect(pricing.lines).toEqual([
      { productId: "p1", variantId: null, variantLabel: null, variantSku: null, quantity: 25, unitPrice: 545.5, gstRate: 18, gstAmount: 2454.75, total: 16092.25 },
      { productId: "p2", variantId: "v1", variantLabel: "Red", variantSku: "SKU-V1", quantity: 8, unitPrice: 1275.25, gstRate: 28, gstAmount: 2856.56, total: 13058.56 },
      { productId: "p3", variantId: null, variantLabel: null, variantSku: null, quantity: 20, unitPrice: 212.4, gstRate: 5, gstAmount: 212.4, total: 4460.4 },
    ]);

    const orderTotal = roundToPaise(pricing.subtotal + pricing.gstAmount);
    expect(orderTotal).toBe(33611.21);

    const shipping = computeShippingQuote({ channel: "B2B", orderTotal });
    expect(shipping.shippingCost).toBe(0); // at/above ₹25,000 → free

    const grandTotal = roundToPaise(orderTotal + shipping.shippingCost);
    expect(grandTotal).toBe(33611.21);
    expect(amountDue("FULL_100", grandTotal)).toBe(33611.21);
  });

  describe("Fixture C — the free-shipping boundary itself", () => {
    // The boundary check is `orderTotal >= FREE_DELIVERY_THRESHOLD` — these
    // two cases pin that it is ">=", not ">", so a future edit that quietly
    // narrows or widens the boundary fails here instead of being discovered
    // by a dealer whose order total happens to land exactly on it.
    it("exactly ₹25,000 → free", () => {
      const pricing = computeOrderPricing({
        channel: "B2B",
        items: [{ productId: "p1", variantId: null, variantLabel: null, variantSku: null, quantity: 1, unitPrice: 25000, gstRate: 0 }],
      });
      const orderTotal = roundToPaise(pricing.subtotal + pricing.gstAmount);
      expect(orderTotal).toBe(25000);

      const shipping = computeShippingQuote({ channel: "B2B", orderTotal });
      expect(shipping.shippingCost).toBe(0);
    });

    it("one paisa under (₹24,999.99) → still charged", () => {
      const pricing = computeOrderPricing({
        channel: "B2B",
        items: [{ productId: "p1", variantId: null, variantLabel: null, variantSku: null, quantity: 1, unitPrice: 24999.99, gstRate: 0 }],
      });
      const orderTotal = roundToPaise(pricing.subtotal + pricing.gstAmount);
      expect(orderTotal).toBe(24999.99);

      const shipping = computeShippingQuote({ channel: "B2B", orderTotal });
      expect(shipping.shippingCost).toBe(1250);
    });
  });

  it("Fixture D — order-level gstAmount now reconciles with the line items (2026-09-18 fix)", () => {
    const pricing = computeOrderPricing({
      channel: "B2B",
      items: [
        { productId: "p1", variantId: null, variantLabel: null, variantSku: null, quantity: 7, unitPrice: 100, gstRate: 12 },
        { productId: "p2", variantId: null, variantLabel: null, variantSku: null, quantity: 3, unitPrice: 133.33, gstRate: 12 },
        { productId: "p3", variantId: null, variantLabel: null, variantSku: null, quantity: 11, unitPrice: 171.11, gstRate: 12 },
      ],
    });

    expect(pricing.subtotal).toBe(2982.2);
    // NEW (fixed): sum of the already-rounded per-line gstAmounts
    // (84 + 48 + 225.87 = 357.87). The OLD /api/orders logic — round the
    // raw accumulated sum once at the end — produced 357.86 for this exact
    // fixture: a paisa less than what the three printed line amounts
    // actually add up to.
    expect(pricing.gstAmount).toBe(357.87);
    expect(pricing.lines.map((l) => l.gstAmount)).toEqual([84, 48, 225.87]);
    expect(pricing.lines.map((l) => l.total)).toEqual([784, 447.99, 2108.08]);

    // The whole point of the fix: this must hold for every order, not just
    // this fixture — the order-level gstAmount IS the sum of the line
    // amounts, not an independent computation that happens to be close.
    expect(roundToPaise(pricing.lines.reduce((sum, l) => sum + l.gstAmount, 0))).toBe(pricing.gstAmount);

    const orderTotal = roundToPaise(pricing.subtotal + pricing.gstAmount);
    const shipping = computeShippingQuote({ channel: "B2B", orderTotal });
    const grandTotal = roundToPaise(orderTotal + shipping.shippingCost);

    expect(orderTotal).toBe(3340.07);
    expect(shipping.shippingCost).toBe(167);
    expect(grandTotal).toBe(3507.07);
    expect(roundToPaise(pricing.lines.reduce((sum, l) => sum + l.total, 0) + shipping.shippingCost)).toBe(grandTotal);
  });
});
