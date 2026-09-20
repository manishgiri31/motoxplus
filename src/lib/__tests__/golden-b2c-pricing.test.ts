import { describe, it, expect } from "vitest";
import { computeOrderPricing } from "@/lib/pricing/compute";
import { roundToPaise } from "@/lib/utils";

/**
 * Golden test for the B2C retail pricing branch (lib/pricing/compute.ts's
 * computeB2CPricing). No B2C catalogue/checkout page calls this yet — this
 * pins the pricing rule itself so a future UI wiring it up inherits
 * known-correct numbers instead of a first live test of the formula.
 *
 * Unlike the B2B golden test, there is no "old inline logic" this must
 * match — these are freshly-derived expected values (computed by hand from
 * the documented rule: item.unitPrice is Product.mrp, GST-inclusive; tax is
 * reverse-calculated out of it), not literals copied from a prior
 * implementation.
 */
describe("golden B2C pricing — MRP is GST-inclusive", () => {
  it("Fixture A — single item, 18% GST, MRP divides evenly", () => {
    const pricing = computeOrderPricing({
      channel: "B2C",
      items: [{ productId: "p1", variantId: null, variantLabel: null, variantSku: null, quantity: 1, unitPrice: 118, gstRate: 18 }],
    });

    expect(pricing.lines).toEqual([
      { productId: "p1", variantId: null, variantLabel: null, variantSku: null, quantity: 1, unitPrice: 118, gstRate: 18, gstAmount: 18, total: 118 },
    ]);
    expect(pricing.subtotal).toBe(100);
    expect(pricing.gstAmount).toBe(18);
  });

  it("Fixture B — multi-item, mixed GST rates, quantities > 1", () => {
    const pricing = computeOrderPricing({
      channel: "B2C",
      items: [
        { productId: "p1", variantId: null, variantLabel: null, variantSku: null, quantity: 3, unitPrice: 999, gstRate: 18 },
        { productId: "p2", variantId: "v1", variantLabel: "Red", variantSku: "SKU-V1", quantity: 2, unitPrice: 640, gstRate: 28 },
        { productId: "p3", variantId: null, variantLabel: null, variantSku: null, quantity: 5, unitPrice: 105, gstRate: 5 },
      ],
    });

    expect(pricing.lines).toEqual([
      { productId: "p1", variantId: null, variantLabel: null, variantSku: null, quantity: 3, unitPrice: 999, gstRate: 18, gstAmount: 457.17, total: 2997 },
      { productId: "p2", variantId: "v1", variantLabel: "Red", variantSku: "SKU-V1", quantity: 2, unitPrice: 640, gstRate: 28, gstAmount: 280, total: 1280 },
      { productId: "p3", variantId: null, variantLabel: null, variantSku: null, quantity: 5, unitPrice: 105, gstRate: 5, gstAmount: 25, total: 525 },
    ]);
    expect(pricing.subtotal).toBe(4039.83);
    expect(pricing.gstAmount).toBe(762.17);

    // Order-level totals must reconcile with the lines — same discipline as
    // the B2B golden test's Fixture D.
    expect(roundToPaise(pricing.lines.reduce((sum, l) => sum + l.gstAmount, 0))).toBe(pricing.gstAmount);
    expect(roundToPaise(pricing.lines.reduce((sum, l) => sum + (l.total - l.gstAmount), 0))).toBe(pricing.subtotal);
    expect(roundToPaise(pricing.subtotal + pricing.gstAmount)).toBe(roundToPaise(pricing.lines.reduce((sum, l) => sum + l.total, 0)));
  });

  it("B2C total always equals the MRP the customer saw — no GST added on top", () => {
    const pricing = computeOrderPricing({
      channel: "B2C",
      items: [{ productId: "p1", variantId: null, variantLabel: null, variantSku: null, quantity: 4, unitPrice: 249, gstRate: 12 }],
    });
    expect(pricing.lines[0].total).toBe(roundToPaise(249 * 4));
    expect(roundToPaise(pricing.subtotal + pricing.gstAmount)).toBe(pricing.lines[0].total);
  });
});
