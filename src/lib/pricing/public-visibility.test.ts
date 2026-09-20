import { describe, it, expect } from "vitest";
import { canSeeWholesalePrice } from "./public-visibility";
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
