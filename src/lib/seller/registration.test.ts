import { describe, expect, it } from "vitest";
import { businessSchema } from "./registration";

const valid = {
  businessName: "Kumar Auto Components",
  businessType: "MANUFACTURER",
  pan: "ABCDE1234F",
  gstin: "07ABCDE1234F1Z5",
  address: "Plot 12, Industrial Area Phase 2",
  state: "Delhi",
  city: "New Delhi",
  pincode: "110020",
};

const errors = (input: object) => {
  const r = businessSchema.safeParse(input);
  if (r.success) return {};
  // First message per field, which is what the onboarding form shows.
  const out: Record<string, string> = {};
  for (const i of r.error.issues) out[String(i.path[0])] ??= i.message;
  return out;
};

describe("businessSchema (mirrors the Java BusinessDetailsService rules)", () => {
  it("accepts a complete business, with or without a GSTIN", () => {
    expect(errors(valid)).toEqual({});
    expect(errors({ ...valid, gstin: "" })).toEqual({});
  });

  it("uppercases PAN/GSTIN before checking them", () => {
    expect(errors({ ...valid, pan: "abcde1234f", gstin: "07abcde1234f1z5" })).toEqual({});
  });

  it("rejects malformed PAN, GSTIN and pincode with the server's messages", () => {
    expect(errors({ ...valid, pan: "ABCDE12" }).pan).toBe("PAN looks like ABCDE1234F");
    expect(errors({ ...valid, gstin: "07ABCDE" }).gstin).toBe("Enter a valid 15-character GSTIN");
    expect(errors({ ...valid, pincode: "012345" }).pincode).toBe("Enter a valid 6-digit pincode");
  });

  it("rejects a GSTIN that belongs to a different PAN", () => {
    expect(errors({ ...valid, gstin: "07ZZZZZ9999Z1Z5" }).gstin).toBe("This GSTIN does not belong to the PAN you entered");
  });

  it("requires a business type, state and a real address", () => {
    const e = errors({ ...valid, businessType: "", state: "", address: "short" });
    expect(Object.keys(e).sort()).toEqual(["address", "businessType", "state"]);
  });
});
