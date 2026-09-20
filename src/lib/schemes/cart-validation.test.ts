import { describe, it, expect, vi, beforeEach } from "vitest";

const prismaMock = {
  scheme: { findUnique: vi.fn() },
};
vi.mock("@/lib/prisma", () => ({ prisma: prismaMock }));

const { validateSchemeSelection, computeTaxableValue } = await import("./cart-validation");

const NOW = new Date("2026-09-20T00:00:00.000Z");
const ACTIVE_WINDOW = { isActive: true, startsAt: new Date("2026-09-01"), endsAt: new Date("2026-09-30") };

function baseScheme(overrides: Partial<Record<string, unknown>> = {}) {
  return {
    id: "scheme1",
    benefitPercent: 18,
    minOrderValue: 10000,
    maxBenefitValue: null,
    eligibleCategories: [],
    ...ACTIVE_WINDOW,
    ...overrides,
  };
}

beforeEach(() => {
  vi.clearAllMocks();
  vi.useFakeTimers();
  vi.setSystemTime(NOW);
});

describe("computeTaxableValue", () => {
  it("sums unitPrice * quantity across lines, rounded to paise", () => {
    expect(
      computeTaxableValue([
        { unitPrice: 100.005, quantity: 3 },
        { unitPrice: 50, quantity: 2 },
      ])
    ).toBe(400.02); // 300.015 + 100 = 400.015 -> 400.02 (banker's-adjacent Math.round with epsilon)
  });

  it("is 0 for an empty cart", () => {
    expect(computeTaxableValue([])).toBe(0);
  });
});

describe("validateSchemeSelection", () => {
  it("fails when the scheme doesn't exist", async () => {
    prismaMock.scheme.findUnique.mockResolvedValue(null);
    const result = await validateSchemeSelection({ schemeId: "missing", regularItems: [], schemeItems: [] });
    expect(result).toEqual({ ok: false, reason: "Scheme not found" });
  });

  it("fails when the scheme is outside its active window", async () => {
    prismaMock.scheme.findUnique.mockResolvedValue(baseScheme({ isActive: false }));
    const result = await validateSchemeSelection({
      schemeId: "scheme1",
      regularItems: [{ unitPrice: 20000, quantity: 1 }],
      schemeItems: [],
    });
    expect(result).toEqual({ ok: false, reason: "This scheme is not currently active" });
  });

  it("fails when taxable value is below minOrderValue", async () => {
    prismaMock.scheme.findUnique.mockResolvedValue(baseScheme());
    const result = await validateSchemeSelection({
      schemeId: "scheme1",
      regularItems: [{ unitPrice: 5000, quantity: 1 }], // taxableValue 5000 < minOrderValue 10000
      schemeItems: [],
    });
    expect(result.ok).toBe(false);
    if (!result.ok) expect(result.reason).toMatch(/at least ₹10000/);
  });

  it("fails when a selected item's category isn't eligible", async () => {
    prismaMock.scheme.findUnique.mockResolvedValue(baseScheme({ eligibleCategories: [{ categoryId: "cat-bearings" }] }));
    const result = await validateSchemeSelection({
      schemeId: "scheme1",
      regularItems: [{ unitPrice: 20000, quantity: 1 }],
      schemeItems: [{ productId: "p1", quantity: 1, dealerPrice: 100, categoryId: "cat-tyres", stockStatus: "IN_STOCK", variantStock: null }],
    });
    expect(result).toEqual({ ok: false, reason: "One or more selected free items are not eligible under this scheme" });
  });

  it("passes category check when the scheme has no category restriction (empty = all eligible)", async () => {
    prismaMock.scheme.findUnique.mockResolvedValue(baseScheme({ eligibleCategories: [] }));
    const result = await validateSchemeSelection({
      schemeId: "scheme1",
      regularItems: [{ unitPrice: 20000, quantity: 1 }],
      schemeItems: [{ productId: "p1", quantity: 1, dealerPrice: 100, categoryId: "cat-anything", stockStatus: "IN_STOCK", variantStock: null }],
    });
    expect(result.ok).toBe(true);
  });

  it("fails when a plain-product scheme item is OUT_OF_STOCK", async () => {
    prismaMock.scheme.findUnique.mockResolvedValue(baseScheme());
    const result = await validateSchemeSelection({
      schemeId: "scheme1",
      regularItems: [{ unitPrice: 20000, quantity: 1 }],
      schemeItems: [{ productId: "p1", quantity: 1, dealerPrice: 100, categoryId: "cat1", stockStatus: "OUT_OF_STOCK", variantStock: null }],
    });
    expect(result).toEqual({ ok: false, reason: "One or more selected free items are out of stock" });
  });

  it("fails when a variant scheme item's stock is below the requested quantity", async () => {
    prismaMock.scheme.findUnique.mockResolvedValue(baseScheme());
    const result = await validateSchemeSelection({
      schemeId: "scheme1",
      regularItems: [{ unitPrice: 20000, quantity: 1 }],
      schemeItems: [{ productId: "p1", quantity: 5, dealerPrice: 100, categoryId: "cat1", stockStatus: "IN_STOCK", variantStock: 3 }],
    });
    expect(result).toEqual({ ok: false, reason: "One or more selected free items are out of stock" });
  });

  it("fails when the selected items' dealer-price total exceeds the earned benefit", async () => {
    prismaMock.scheme.findUnique.mockResolvedValue(baseScheme()); // 18% benefit
    // taxableValue 20000 -> benefit 3600. Selected items worth 4000 > 3600.
    const result = await validateSchemeSelection({
      schemeId: "scheme1",
      regularItems: [{ unitPrice: 20000, quantity: 1 }],
      schemeItems: [{ productId: "p1", quantity: 1, dealerPrice: 4000, categoryId: "cat1", stockStatus: "IN_STOCK", variantStock: null }],
    });
    expect(result.ok).toBe(false);
    if (!result.ok) expect(result.reason).toMatch(/exceed the earned benefit/);
  });

  it("succeeds and returns taxableValue/benefit/itemsValue on a fully valid selection", async () => {
    prismaMock.scheme.findUnique.mockResolvedValue(baseScheme({ maxBenefitValue: 5000 }));
    const result = await validateSchemeSelection({
      schemeId: "scheme1",
      regularItems: [{ unitPrice: 20000, quantity: 1 }], // taxableValue 20000, benefit 18% = 3600 (under the 5000 cap)
      schemeItems: [{ productId: "p1", quantity: 2, dealerPrice: 900, categoryId: "cat1", stockStatus: "IN_STOCK", variantStock: 10 }],
    });
    expect(result).toEqual({
      ok: true,
      scheme: { id: "scheme1", benefitPercent: 18, minOrderValue: 10000, maxBenefitValue: 5000 },
      taxableValue: 20000,
      benefit: 3600,
      itemsValue: 1800,
    });
  });
});
