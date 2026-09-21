import { describe, it, expect } from "vitest";
import { channelForRole, displayChannel } from "./channel";
import type { Session } from "next-auth";

function sessionWithRole(role: string | undefined): Session | null {
  if (!role) return null;
  return { user: { role } } as unknown as Session;
}

describe("channelForRole", () => {
  it("DEALER -> B2B, CUSTOMER -> B2C", () => {
    expect(channelForRole("DEALER")).toBe("B2B");
    expect(channelForRole("CUSTOMER")).toBe("B2C");
  });

  it("every other role (or no role) -> null — never places an order itself", () => {
    expect(channelForRole("ADMIN")).toBeNull();
    expect(channelForRole("SUPER_ADMIN")).toBeNull();
    expect(channelForRole("VENDOR")).toBeNull();
    expect(channelForRole("STAFF")).toBeNull();
    expect(channelForRole(null)).toBeNull();
    expect(channelForRole(undefined)).toBeNull();
  });
});

describe("displayChannel", () => {
  it("logged-in CUSTOMER sees B2C", () => {
    expect(displayChannel(sessionWithRole("CUSTOMER"))).toBe("B2C");
  });

  // Deliberate business call (commit 7ec1eb6): a guest, a dealer, and admin/
  // staff previewing the storefront all see the existing B2B (wholesale)
  // display — only a logged-in retail customer gets the B2C view.
  it("guest (no session), DEALER, and ADMIN all see B2B", () => {
    expect(displayChannel(null)).toBe("B2B");
    expect(displayChannel(sessionWithRole("DEALER"))).toBe("B2B");
    expect(displayChannel(sessionWithRole("ADMIN"))).toBe("B2B");
    expect(displayChannel(sessionWithRole("STAFF"))).toBe("B2B");
  });
});
