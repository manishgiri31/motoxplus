import { describe, it, expect, beforeEach, afterEach, vi } from "vitest";

// Env is read lazily and cached per channel, so each test re-imports a fresh module.
// Token values here are dummy strings built in the test — no real secrets.
const KEYS = [
  "DELHIVERY_TOKEN",
  "DELHIVERY_TOKEN_B2C",
  "DELHIVERY_PICKUP_LOCATION_NAME",
  "DELHIVERY_PICKUP_LOCATION_B2C",
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

describe("getDelhiveryConfig — B2C (track.delhivery.com)", () => {
  it("prefers the _B2C vars", async () => {
    Object.assign(process.env, {
      DELHIVERY_TOKEN_B2C: "c".repeat(24),
      DELHIVERY_PICKUP_LOCATION_B2C: "LOC C",
      DELHIVERY_TOKEN: "l".repeat(24),
      DELHIVERY_PICKUP_LOCATION_NAME: "LEGACY",
    });
    const { getDelhiveryConfig } = await import("./config");
    expect(getDelhiveryConfig("B2C")).toMatchObject({ token: "c".repeat(24), pickup: { locationName: "LOC C" } });
  });

  it("falls back to the legacy single-client vars; no-arg means B2C", async () => {
    Object.assign(process.env, { DELHIVERY_TOKEN: "l".repeat(24), DELHIVERY_PICKUP_LOCATION_NAME: "LEGACY" });
    const { getDelhiveryConfig } = await import("./config");

    expect(getDelhiveryConfig()).toMatchObject({
      channel: "B2C",
      token: "l".repeat(24),
      baseUrl: "https://track.delhivery.com",
      pickup: { locationName: "LEGACY" },
    });
  });

  it("rejects the .env.example placeholder token (24 chars, so the length check alone let it through)", async () => {
    Object.assign(process.env, { DELHIVERY_TOKEN: "your_delhivery_api_token", DELHIVERY_PICKUP_LOCATION_NAME: "LEGACY" });
    const { getDelhiveryConfig } = await import("./config");
    expect(() => getDelhiveryConfig("B2C")).toThrow(/DELHIVERY_TOKEN: is still the \.env\.example placeholder/);
  });

  it("strips a trailing slash from DELHIVERY_BASE_URL and treats an empty one as unset", async () => {
    Object.assign(process.env, { DELHIVERY_TOKEN: "l".repeat(24), DELHIVERY_PICKUP_LOCATION_NAME: "LEGACY" });
    process.env.DELHIVERY_BASE_URL = "https://track.delhivery.com/";
    let { getDelhiveryConfig } = await import("./config");
    expect(getDelhiveryConfig("B2C").baseUrl).toBe("https://track.delhivery.com");

    vi.resetModules();
    process.env.DELHIVERY_BASE_URL = "";
    ({ getDelhiveryConfig } = await import("./config"));
    expect(getDelhiveryConfig("B2C").baseUrl).toBe("https://track.delhivery.com");
  });

  it("rejects a token under 20 characters", async () => {
    Object.assign(process.env, { DELHIVERY_TOKEN_B2C: "short", DELHIVERY_PICKUP_LOCATION_B2C: "LOC C" });
    const { getDelhiveryConfig } = await import("./config");
    expect(() => getDelhiveryConfig("B2C")).toThrow(/under 20 characters/);
  });
});

describe("getDelhiveryConfig — B2B is refused (it is not a track.delhivery.com client)", () => {
  it("throws even when a B2C token is configured, so B2B can never borrow it", async () => {
    Object.assign(process.env, { DELHIVERY_TOKEN: "l".repeat(24), DELHIVERY_PICKUP_LOCATION_NAME: "LEGACY" });
    const { getDelhiveryConfig } = await import("./config");
    const { DelhiveryConfigError } = await import("./errors");

    expect(() => getDelhiveryConfig("B2B")).toThrow(DelhiveryConfigError);
    expect(() => getDelhiveryConfig("B2B")).toThrow(/b2b/i);
  });
});
