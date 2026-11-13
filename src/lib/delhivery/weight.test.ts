import { describe, expect, it } from "vitest";
import { calculateOrderWeight, itemChargeableWeightKg } from "./weight";

describe("itemChargeableWeightKg", () => {
  it("uses actual weight when it is heavier than the volumetric weight", () => {
    // 3 kg actual; 20×15×10 = 3000 cm³ → 0.6 kg volumetric
    expect(itemChargeableWeightKg({ packageWeight: 3, packageLength: 20, packageWidth: 15, packageHeight: 10 })).toBe(3);
  });

  it("uses volumetric weight for a bulky, light item", () => {
    // 0.2 kg actual; 40×30×20 = 24000 cm³ → 4.8 kg volumetric
    expect(itemChargeableWeightKg({ packageWeight: 0.2, packageLength: 40, packageWidth: 30, packageHeight: 20 })).toBeCloseTo(4.8);
  });

  it("falls back to actual weight when any side is missing", () => {
    expect(itemChargeableWeightKg({ packageWeight: 0.2, packageLength: 40, packageWidth: 30, packageHeight: null })).toBe(0.2);
  });

  it("falls back to the legacy weight field, then to 0.5 kg, when packageWeight is missing", () => {
    expect(itemChargeableWeightKg({ weight: 1.5 })).toBe(1.5);
    expect(itemChargeableWeightKg({})).toBe(0.5);
  });
});

describe("calculateOrderWeight", () => {
  it("multiplies each item's chargeable weight by its quantity", () => {
    const total = calculateOrderWeight([
      { quantity: 2, product: { packageWeight: 1 } },
      { quantity: 3, product: { packageWeight: 0.25 } },
    ]);
    expect(total).toBeCloseTo(2.75);
  });

  it("never returns less than the 0.5 kg slab minimum", () => {
    expect(calculateOrderWeight([{ quantity: 1, product: { packageWeight: 0.1 } }])).toBe(0.5);
  });

  it("does not silently under-charge a bulky item that has no weight entered", () => {
    // Volumetric 4.8 kg must win over the 0.5 kg default.
    expect(
      calculateOrderWeight([
        { quantity: 1, product: { packageLength: 40, packageWidth: 30, packageHeight: 20 } },
      ]),
    ).toBeCloseTo(4.8);
  });
});
