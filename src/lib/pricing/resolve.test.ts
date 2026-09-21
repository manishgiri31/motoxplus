import { describe, it, expect } from "vitest";
import { resolveUnitPrice } from "./resolve";

describe("resolveUnitPrice", () => {
  it("B2B: variant.price wins over product.price when a variant is given", () => {
    expect(
      resolveUnitPrice({ channel: "B2B", product: { price: 100, mrp: 150 }, variant: { price: 90, mrp: 140 } })
    ).toBe(90);
  });

  it("B2B: falls back to product.price with no variant", () => {
    expect(resolveUnitPrice({ channel: "B2B", product: { price: 100, mrp: 150 }, variant: null })).toBe(100);
  });

  it("B2C: variant.mrp wins over product.mrp when a variant is given", () => {
    expect(
      resolveUnitPrice({ channel: "B2C", product: { price: 100, mrp: 150 }, variant: { price: 90, mrp: 140 } })
    ).toBe(140);
  });

  it("B2C: falls back to product.mrp with no variant", () => {
    expect(resolveUnitPrice({ channel: "B2C", product: { price: 100, mrp: 150 }, variant: null })).toBe(150);
  });

  it("B2C: variant with mrp null falls through to product.mrp", () => {
    expect(
      resolveUnitPrice({ channel: "B2C", product: { price: 100, mrp: 150 }, variant: { price: 90, mrp: null } })
    ).toBe(150);
  });

  // D9 / C6: a product with no retail price is never orderable at retail —
  // this must NEVER fall back to the wholesale (B2B) rate.
  it("B2C: no mrp anywhere -> null, never the wholesale price", () => {
    expect(resolveUnitPrice({ channel: "B2C", product: { price: 100, mrp: null }, variant: null })).toBeNull();
    expect(
      resolveUnitPrice({ channel: "B2C", product: { price: 100, mrp: null }, variant: { price: 90, mrp: null } })
    ).toBeNull();
  });
});
