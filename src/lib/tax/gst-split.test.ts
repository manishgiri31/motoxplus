import { describe, it, expect } from "vitest";
import { computeGstSplit, UnrecognizedStateError } from "./gst-split";

describe("computeGstSplit", () => {
  it("same state -> CGST + SGST split evenly, IGST zero", () => {
    expect(computeGstSplit({ placeOfSupply: "Delhi", sellerState: "Delhi", gstAmount: 1000 })).toEqual({
      cgstAmount: 500,
      sgstAmount: 500,
      igstAmount: 0,
    });
  });

  it("same state, tolerant of different spellings of the same state", () => {
    expect(computeGstSplit({ placeOfSupply: "DELHI", sellerState: "  delhi ", gstAmount: 1000 })).toEqual({
      cgstAmount: 500,
      sgstAmount: 500,
      igstAmount: 0,
    });
    expect(computeGstSplit({ placeOfSupply: "NCT of Delhi", sellerState: "DL", gstAmount: 1000 })).toEqual({
      cgstAmount: 500,
      sgstAmount: 500,
      igstAmount: 0,
    });
  });

  it("different state -> IGST gets the full amount, CGST/SGST zero", () => {
    expect(computeGstSplit({ placeOfSupply: "Haryana", sellerState: "Delhi", gstAmount: 1000 })).toEqual({
      cgstAmount: 0,
      sgstAmount: 0,
      igstAmount: 1000,
    });
  });

  it("throws on an unrecognized place of supply rather than silently defaulting", () => {
    expect(() => computeGstSplit({ placeOfSupply: "Narnia", sellerState: "Delhi", gstAmount: 1000 })).toThrow(
      UnrecognizedStateError
    );
  });

  it("throws on an unrecognized seller state", () => {
    expect(() => computeGstSplit({ placeOfSupply: "Delhi", sellerState: "Narnia", gstAmount: 1000 })).toThrow(
      UnrecognizedStateError
    );
  });

  // The whole point of the fix: cgst + sgst + igst must equal gstAmount for
  // every input, including odd-paisa amounts that don't split evenly.
  describe("cgst + sgst + igst always reconciles to gstAmount", () => {
    const amounts = [1000, 357.87, 0.01, 0.03, 2265.51, 99999.99, 0];

    // Compared with toBeCloseTo, not toBe: summing two independently-rounded
    // paise floats can land a IEEE-754 hair off the target (e.g. 50000 +
    // 49999.99 = 99999.98999999999) even when both values are themselves
    // exactly correct to the paisa — the same reason the production
    // gstAmount-drift query (docs/CHANGELOG-behaviour.md) checks
    // ABS(diff) > 0.001 rather than exact equality.
    it("same-state case", () => {
      for (const gstAmount of amounts) {
        const result = computeGstSplit({ placeOfSupply: "Delhi", sellerState: "Delhi", gstAmount });
        expect(result.cgstAmount + result.sgstAmount + result.igstAmount).toBeCloseTo(gstAmount, 2);
      }
    });

    it("inter-state case", () => {
      for (const gstAmount of amounts) {
        const result = computeGstSplit({ placeOfSupply: "Maharashtra", sellerState: "Delhi", gstAmount });
        expect(result.cgstAmount + result.sgstAmount + result.igstAmount).toBeCloseTo(gstAmount, 2);
      }
    });

    it("an odd-paisa amount splits into two paise that individually differ by at most 0.01", () => {
      const result = computeGstSplit({ placeOfSupply: "Delhi", sellerState: "Delhi", gstAmount: 357.87 });
      expect(result.cgstAmount).toBe(178.94);
      expect(result.sgstAmount).toBe(178.93);
      expect(result.cgstAmount + result.sgstAmount).toBe(357.87);
    });
  });
});
