import { describe, it, expect } from "vitest";
import { resolveGstStateCode, GST_STATE_CODES } from "./state-codes";

describe("resolveGstStateCode", () => {
  it("resolves every canonical state/UT name to its official code", () => {
    expect(resolveGstStateCode("Delhi")).toBe("07");
    expect(resolveGstStateCode("Haryana")).toBe("06");
    expect(resolveGstStateCode("Maharashtra")).toBe("27");
    expect(resolveGstStateCode("Tamil Nadu")).toBe("33");
    expect(resolveGstStateCode("Andhra Pradesh")).toBe("37");
    expect(resolveGstStateCode("Telangana")).toBe("36");
    expect(resolveGstStateCode("Jammu and Kashmir")).toBe("01");
    expect(resolveGstStateCode("Dadra and Nagar Haveli and Daman and Diu")).toBe("26");
  });

  it("is case-insensitive and tolerates surrounding whitespace", () => {
    expect(resolveGstStateCode("  HARYANA  ")).toBe("06");
    expect(resolveGstStateCode("haryana")).toBe("06");
    expect(resolveGstStateCode("HaRyAnA")).toBe("06");
  });

  it("resolves common postal abbreviations", () => {
    expect(resolveGstStateCode("HR")).toBe("06");
    expect(resolveGstStateCode("DL")).toBe("07");
    expect(resolveGstStateCode("UP")).toBe("09");
    expect(resolveGstStateCode("MH")).toBe("27");
    expect(resolveGstStateCode("TN")).toBe("33");
    expect(resolveGstStateCode("AP")).toBe("37");
    expect(resolveGstStateCode("TS")).toBe("36");
  });

  it("resolves alternate/old names and '&' vs 'and'", () => {
    expect(resolveGstStateCode("Orissa")).toBe("21");
    expect(resolveGstStateCode("Pondicherry")).toBe("34");
    expect(resolveGstStateCode("NCT of Delhi")).toBe("07");
    expect(resolveGstStateCode("New Delhi")).toBe("07");
    expect(resolveGstStateCode("Jammu & Kashmir")).toBe("01");
    expect(resolveGstStateCode("Dadra & Nagar Haveli")).toBe("26");
    expect(resolveGstStateCode("Uttaranchal")).toBe("05");
  });

  it("returns null for unrecognized input rather than guessing", () => {
    expect(resolveGstStateCode("")).toBeNull();
    expect(resolveGstStateCode("Narnia")).toBeNull();
    expect(resolveGstStateCode("123456")).toBeNull();
  });

  it("every code in the canonical table is a unique 2-digit string", () => {
    const codes = Object.values(GST_STATE_CODES);
    expect(new Set(codes).size).toBe(codes.length);
    for (const code of codes) expect(code).toMatch(/^\d{2}$/);
  });
});
