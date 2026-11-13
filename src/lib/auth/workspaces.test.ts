import { describe, expect, it } from "vitest";
import { availableWorkspaces, switchError } from "./workspaces";

describe("workspaces", () => {
  const dealerAndVendor = { role: "DEALER", dealer: { id: "d" }, vendor: { id: "v" }, customer: null };

  it("lists every profile on the account", () => {
    expect(availableWorkspaces(dealerAndVendor)).toEqual(["DEALER", "VENDOR"]);
    expect(availableWorkspaces({ role: "VENDOR", vendor: { id: "v" } })).toEqual(["VENDOR"]);
  });

  it("allows switching only to a profile the account owns", () => {
    expect(switchError(dealerAndVendor, "VENDOR")).toBeNull();
    expect(switchError(dealerAndVendor, "DEALER")).toBeNull();
    expect(switchError(dealerAndVendor, "CUSTOMER")).toMatch(/no customer profile/);
    expect(switchError(dealerAndVendor, "ADMIN")).toBe("Unknown workspace");
  });

  it("never lets a staff or admin account switch, even if it has profiles", () => {
    const admin = { role: "ADMIN", dealer: { id: "d" }, vendor: { id: "v" } };
    expect(availableWorkspaces(admin)).toEqual([]);
    expect(switchError(admin, "VENDOR")).toMatch(/Staff/);
  });
});
