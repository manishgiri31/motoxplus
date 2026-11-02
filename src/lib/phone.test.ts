import { describe, it, expect } from "vitest";
import { normalizeIndianMobile, toWhatsAppPhone } from "./phone";

describe("toWhatsAppPhone", () => {
  it("prefixes 91 onto a bare 10-digit number", () => {
    expect(toWhatsAppPhone("9876543210")).toBe("919876543210");
  });

  it("strips spaces, plus, dashes, dots and brackets", () => {
    expect(toWhatsAppPhone("+91 98765-43210")).toBe("919876543210");
    expect(toWhatsAppPhone("(98765) 43.210")).toBe("919876543210");
  });

  it("handles a trunk 0 and an existing country code", () => {
    expect(toWhatsAppPhone("09876543210")).toBe("919876543210");
    expect(toWhatsAppPhone("919876543210")).toBe("919876543210");
  });

  it("keeps a non-Indian number that already has a country code", () => {
    expect(toWhatsAppPhone("+1 415 555 2671")).toBe("14155552671");
  });

  it("returns null for empty, non-numeric, too short, too long, or non-mobile Indian input", () => {
    expect(toWhatsAppPhone(null)).toBeNull();
    expect(toWhatsAppPhone("")).toBeNull();
    expect(toWhatsAppPhone("98765abc10")).toBeNull();
    expect(toWhatsAppPhone("98765")).toBeNull();
    expect(toWhatsAppPhone("1234567890123456")).toBeNull();
    expect(toWhatsAppPhone("911234567890")).toBeNull();
  });
});

describe("normalizeIndianMobile", () => {
  it("accepts a bare 10-digit Indian mobile number", () => {
    expect(normalizeIndianMobile("9876543210")).toBe("9876543210");
  });

  it("strips a '+91' country code prefix", () => {
    expect(normalizeIndianMobile("+919876543210")).toBe("9876543210");
  });

  it("strips a '91' country code prefix without a '+'", () => {
    expect(normalizeIndianMobile("919876543210")).toBe("9876543210");
  });

  it("strips a leading landline-dialing '0'", () => {
    expect(normalizeIndianMobile("09876543210")).toBe("9876543210");
  });

  it("tolerates embedded spaces and hyphens", () => {
    expect(normalizeIndianMobile("+91 98765-43210")).toBe("9876543210");
    expect(normalizeIndianMobile("98765 43210")).toBe("9876543210");
  });

  it("does not blindly prepend +91 to a number that already carries a country code", () => {
    // A 12-digit input starting with "91" is treated as country-code+number,
    // not as a literal 10-digit number that happens to start with "91".
    expect(normalizeIndianMobile("919876543210")).toBe("9876543210");
  });

  it("rejects a number not starting with 6-9 (invalid Indian mobile prefix)", () => {
    expect(normalizeIndianMobile("5876543210")).toBeNull();
    expect(normalizeIndianMobile("1234567890")).toBeNull();
  });

  it("rejects numbers that are too short or too long", () => {
    expect(normalizeIndianMobile("98765432")).toBeNull();
    expect(normalizeIndianMobile("987654321012345")).toBeNull();
  });

  it("rejects empty, whitespace-only, and non-numeric input", () => {
    expect(normalizeIndianMobile("")).toBeNull();
    expect(normalizeIndianMobile("   ")).toBeNull();
    expect(normalizeIndianMobile("not-a-number")).toBeNull();
  });

  it("rejects a malformed +91 number with the wrong digit count", () => {
    expect(normalizeIndianMobile("+9198765432")).toBeNull();
    expect(normalizeIndianMobile("+919876543210999")).toBeNull();
  });
});
