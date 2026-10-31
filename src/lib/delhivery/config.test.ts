import { describe, it, expect, beforeEach, afterEach, vi } from "vitest";

// Env is read lazily and cached per channel, so each test re-imports a fresh module.
// Token values here are dummy strings built in the test — no real secrets.
const KEYS = [
  "DELHIVERY_TOKEN",
  "DELHIVERY_TOKEN_B2C",
  "DELHIVERY_TOKEN_B2B",
  "DELHIVERY_PICKUP_LOCATION_NAME",
  "DELHIVERY_PICKUP_LOCATION_B2C",
  "DELHIVERY_PICKUP_LOCATION_B2B",
];
const saved = { ...process.env };

beforeEach(() => {
  vi.resetModules();
  for (const k of KEYS) delete process.env[k];
  Object.assign(process.env, {
    DELHIVERY_PICKUP_NAME: "n",
    DELHIVERY_PICKUP_ADDRESS: "a",
    DELHIVERY_PICKUP_CITY: "c",
    DELHIVERY_PICKUP_STATE: "s",
    DELHIVERY_PICKUP_PHONE: "p",
    DELHIVERY_ORIGIN_PINCODE: "110046",
    COMPANY_GST: "gst",
    DELHIVERY_CLIENT_NAME: "client",
  });
});
afterEach(() => {
  process.env = { ...saved };
});

describe("getDelhiveryConfig — channel selection", () => {
  it("selects the token and pickup location of the requested channel", async () => {
    Object.assign(process.env, {
      DELHIVERY_TOKEN_B2C: "c".repeat(24),
      DELHIVERY_PICKUP_LOCATION_B2C: "LOC C",
      DELHIVERY_TOKEN_B2B: "b".repeat(24),
      DELHIVERY_PICKUP_LOCATION_B2B: "LOC B",
    });
    const { getDelhiveryConfig } = await import("./config");

    expect(getDelhiveryConfig("B2C")).toMatchObject({ token: "c".repeat(24), pickup: { locationName: "LOC C" } });
    expect(getDelhiveryConfig("B2B")).toMatchObject({ token: "b".repeat(24), pickup: { locationName: "LOC B" } });
  });

  it("B2C falls back to the legacy single-client vars; no-arg means B2C", async () => {
    Object.assign(process.env, { DELHIVERY_TOKEN: "l".repeat(24), DELHIVERY_PICKUP_LOCATION_NAME: "LEGACY" });
    const { getDelhiveryConfig } = await import("./config");

    expect(getDelhiveryConfig()).toMatchObject({
      channel: "B2C",
      token: "l".repeat(24),
      pickup: { locationName: "LEGACY" },
    });
  });

  it("B2B never falls back to the B2C/legacy token — it throws instead", async () => {
    Object.assign(process.env, { DELHIVERY_TOKEN: "l".repeat(24), DELHIVERY_PICKUP_LOCATION_NAME: "LEGACY" });
    const { getDelhiveryConfig } = await import("./config");
    const { DelhiveryConfigError } = await import("./errors");

    expect(() => getDelhiveryConfig("B2B")).toThrow(DelhiveryConfigError);
    expect(() => getDelhiveryConfig("B2B")).toThrow(/DELHIVERY_TOKEN_B2B/);
  });

  it("rejects a token under 20 characters", async () => {
    Object.assign(process.env, { DELHIVERY_TOKEN_B2B: "short", DELHIVERY_PICKUP_LOCATION_B2B: "LOC B" });
    const { getDelhiveryConfig } = await import("./config");
    expect(() => getDelhiveryConfig("B2B")).toThrow(/under 20 characters/);
  });
});
