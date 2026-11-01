import { describe, it, expect } from "vitest";
import { canSeeWholesalePrice, canSeeWholesalePriceForRole } from "./public-visibility";
import type { Session } from "next-auth";

function sessionWithRole(role: string | undefined): Session | null {
  if (!role) return null;
  return { user: { role } } as unknown as Session;
}

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

describe("canSeeWholesalePriceForRole", () => {
  it("accepts the same roles as the session variant", () => {
    for (const role of ["DEALER", "ADMIN", "SUPER_ADMIN", "STAFF"]) {
      expect(canSeeWholesalePriceForRole(role)).toBe(true);
    }
  });

  it("rejects anonymous, customers and vendors", () => {
    expect(canSeeWholesalePriceForRole(null)).toBe(false);
    expect(canSeeWholesalePriceForRole(undefined)).toBe(false);
    expect(canSeeWholesalePriceForRole("CUSTOMER")).toBe(false);
    expect(canSeeWholesalePriceForRole("VENDOR")).toBe(false);
  });
});
