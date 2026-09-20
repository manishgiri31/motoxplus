import { describe, it, expect } from "vitest";
import { isDealerViewer, canSeeWholesalePrice, stripWholesalePrice, stripWholesalePriceFromList } from "./public-visibility";
import type { Session } from "next-auth";

function sessionWithRole(role: string | undefined): Session | null {
  if (!role) return null;
  return { user: { role } } as unknown as Session;
}

describe("isDealerViewer", () => {
  it("is true only for a DEALER session", () => {
    expect(isDealerViewer(sessionWithRole("DEALER"))).toBe(true);
    expect(isDealerViewer(sessionWithRole("ADMIN"))).toBe(false);
    expect(isDealerViewer(sessionWithRole("SUPER_ADMIN"))).toBe(false);
    expect(isDealerViewer(sessionWithRole("STAFF"))).toBe(false);
    expect(isDealerViewer(null)).toBe(false);
  });
});

describe("canSeeWholesalePrice", () => {
  it("is true for DEALER, ADMIN, SUPER_ADMIN, and STAFF", () => {
    expect(canSeeWholesalePrice(sessionWithRole("DEALER"))).toBe(true);
    expect(canSeeWholesalePrice(sessionWithRole("ADMIN"))).toBe(true);
    expect(canSeeWholesalePrice(sessionWithRole("SUPER_ADMIN"))).toBe(true);
    expect(canSeeWholesalePrice(sessionWithRole("STAFF"))).toBe(true);
  });

  it("is false for a guest (no session) or an unrelated role", () => {
    expect(canSeeWholesalePrice(null)).toBe(false);
    expect(canSeeWholesalePrice(sessionWithRole("VENDOR"))).toBe(false);
    expect(canSeeWholesalePrice(sessionWithRole("GUEST"))).toBe(false);
  });
});

describe("stripWholesalePrice", () => {
  const product = {
    id: "p1",
    name: "Test Part",
    price: 500,
    mrp: 800,
    vendorCostPrice: 300,
    markupPercent: 20,
    variants: [
      { id: "v1", label: "Red", price: 550, mrp: 850 },
      { id: "v2", label: "Blue", price: 560, mrp: 860 },
    ],
  };

  it("leaves the product untouched when the viewer is authorized", () => {
    expect(stripWholesalePrice(product, true)).toEqual(product);
  });

  it("removes price, vendorCostPrice, markupPercent, and every variant's price for an unauthorized viewer", () => {
    const stripped = stripWholesalePrice(product, false);
    expect(stripped).not.toHaveProperty("price");
    expect(stripped).not.toHaveProperty("vendorCostPrice");
    expect(stripped).not.toHaveProperty("markupPercent");
    expect(stripped.mrp).toBe(800);
    expect(stripped.variants).toEqual([
      { id: "v1", label: "Red", mrp: 850 },
      { id: "v2", label: "Blue", mrp: 860 },
    ]);
    for (const variant of stripped.variants) {
      expect(variant).not.toHaveProperty("price");
    }
  });

  it("never mutates the original product object", () => {
    const original = JSON.parse(JSON.stringify(product));
    stripWholesalePrice(product, false);
    expect(product).toEqual(original);
  });

  it("is a no-op on a product with no variants array", () => {
    const noVariants = { id: "p2", price: 100, mrp: 150 };
    expect(stripWholesalePrice(noVariants, false)).toEqual({ id: "p2", mrp: 150 });
  });
});

describe("stripWholesalePriceFromList", () => {
  it("applies the strip to every product in the array", () => {
    const products = [
      { id: "p1", price: 100, mrp: 150 },
      { id: "p2", price: 200, mrp: 250 },
    ];
    const stripped = stripWholesalePriceFromList(products, false);
    expect(stripped).toEqual([
      { id: "p1", mrp: 150 },
      { id: "p2", mrp: 250 },
    ]);
  });
});
