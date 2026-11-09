import { describe, expect, it } from "vitest";
import { gstinCheckChar, isWellFormedGstin, normalizeGstin } from "./gstin";

describe("isWellFormedGstin", () => {
  it("accepts GSTINs with a correct check digit", () => {
    // Publicly listed GSTINs (well-known examples of the format).
    expect(isWellFormedGstin("27AAPFU0939F1ZV")).toBe(true);
    expect(isWellFormedGstin("29AAGCB7383J1Z4")).toBe(true);
  });

  it("rejects a GSTIN that matches the pattern but has the wrong check digit", () => {
    // Same as above with the last character changed: the regex alone would pass this.
    expect(isWellFormedGstin("27AAPFU0939F1ZW")).toBe(false);
    expect(isWellFormedGstin("22AAAAA0000A1Z6")).toBe(false);
  });

  it("rejects bad state codes, lowercase and wrong shapes", () => {
    const base = "AAPFU0939F1Z";
    const withState = (s: string) => s + base + gstinCheckChar(s + base);
    expect(isWellFormedGstin(withState("27"))).toBe(true);
    expect(isWellFormedGstin(withState("00"))).toBe(false);
    expect(isWellFormedGstin(withState("45"))).toBe(false);
    expect(isWellFormedGstin("27aapfu0939f1zv")).toBe(false);
    expect(isWellFormedGstin("27AAPFU0939F1Z")).toBe(false);
    expect(isWellFormedGstin("")).toBe(false);
  });

  it("normalizes spacing and case", () => {
    expect(normalizeGstin(" 27aapfu 0939f1zv ")).toBe("27AAPFU0939F1ZV");
  });
});
