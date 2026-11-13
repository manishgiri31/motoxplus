import { describe, it, expect, vi, beforeEach, afterEach } from "vitest";
import type { DelhiveryPincodeResponse } from "./types";

// End-to-end through the REAL client + config (serviceability.test.ts mocks delhiveryFetch away, which is why
// it never caught the production failure). Only global fetch is mocked. Token values are dummies built here.
//
// Production symptom: every pincode, including 135001, answered "Unable to check serviceability". Delhivery
// answers a bad token with 401 text/html "Login or API Key Required" (verified live against
// track.delhivery.com with the .env.example placeholder). The placeholder "your_delhivery_api_token" is 24
// characters, so the old length-only (>= 20) check let it through.

const PLACEHOLDER_TOKEN = "your_delhivery_api_token"; // verbatim from .env.example
const DUMMY_TOKEN = "0123456789abcdef0123456789abcdef01234567"; // shape of a real one (40 hex), not a real one

const FIXTURE_135001: DelhiveryPincodeResponse = {
  delivery_codes: [
    {
      postal_code: {
        remarks: "",
        pin: 135001,
        country_code: "IN",
        state_code: "HR",
        cod: "Y",
        pre_paid: "Y",
        pickup: "Y",
        cash: "Y",
        repl: "Y",
        district: "Yamuna Nagar",
        is_oda: "N",
        sort_code: "CHA/RAM",
        max_amount: 0.0,
        max_weight: 0.0,
        covid_zone: "G",
        inc: "Yamunanagar_Veerngrcly_D (Haryana)",
        center: [],
        city: "Yamuna Nagar",
        sun_tat: true,
        protect_blacklist: false,
        srv_wt_th: 4500.0,
      },
    },
  ],
};

const KEYS = ["DELHIVERY_TOKEN", "DELHIVERY_TOKEN_B2C", "DELHIVERY_BASE_URL", "DELHIVERY_PICKUP_LOCATION_B2C"];
const saved = { ...process.env };
const fetchMock = vi.fn();

function json(body: unknown, status = 200) {
  return new Response(JSON.stringify(body), { status, headers: { "content-type": "application/json" } });
}

async function load() {
  // config caches per channel — a fresh module graph per test so each env takes effect.
  vi.resetModules();
  return import("./serviceability");
}

beforeEach(() => {
  for (const k of KEYS) delete process.env[k];
  Object.assign(process.env, {
    DELHIVERY_TOKEN: DUMMY_TOKEN,
    DELHIVERY_PICKUP_LOCATION_NAME: "MOTOXPLUS",
    DELHIVERY_PICKUP_NAME: "n",
    DELHIVERY_PICKUP_ADDRESS: "a",
    DELHIVERY_PICKUP_CITY: "c",
    DELHIVERY_PICKUP_STATE: "s",
    DELHIVERY_PICKUP_PHONE: "9999999999",
    DELHIVERY_ORIGIN_PINCODE: "110045",
    COMPANY_GST: "gst",
    DELHIVERY_CLIENT_NAME: "client",
  });
  fetchMock.mockReset();
  vi.stubGlobal("fetch", fetchMock);
  vi.spyOn(console, "error").mockImplementation(() => {});
});
afterEach(() => {
  vi.unstubAllGlobals();
  vi.restoreAllMocks();
  process.env = { ...saved };
});

describe("checkServiceability(135001) over HTTP", () => {
  it("is serviceable with a valid token on the production host", async () => {
    fetchMock.mockResolvedValue(json(FIXTURE_135001));
    const { checkServiceability } = await load();

    const result = await checkServiceability("135001");

    expect(result).toEqual({
      serviceable: true,
      estimatedDeliveryDays: 3,
      availableServices: ["Prepaid", "COD", "Pickup"],
      city: "Yamuna Nagar",
      state: null,
    });
    const [url, init] = fetchMock.mock.calls[0];
    expect(url).toBe("https://track.delhivery.com/c/api/pin-codes/json/?filter_codes=135001");
    expect((init as RequestInit).headers).toMatchObject({ Authorization: `Token ${DUMMY_TOKEN}` });
  });

  it("reproduces the production failure: the .env.example placeholder token is now refused before any call", async () => {
    process.env.DELHIVERY_TOKEN = PLACEHOLDER_TOKEN;
    // What Delhivery actually answers that token with (captured live).
    fetchMock.mockResolvedValue(
      new Response("Login or API Key Required", { status: 401, headers: { "content-type": "text/html; charset=utf-8" } })
    );
    const { checkServiceability } = await load();

    const result = await checkServiceability("135001");

    expect(result.serviceable).toBe(false);
    expect(result.error).toBe("Unable to check serviceability. Please try again.");
    expect(fetchMock).not.toHaveBeenCalled();
    // The log names the variable instead of a bare 401.
    const logged = String(vi.mocked(console.error).mock.calls[0]?.[1]);
    expect(logged).toMatch(/DELHIVERY_TOKEN: is still the \.env\.example placeholder/);
    expect(logged).not.toContain(PLACEHOLDER_TOKEN);
  });

  it("a 401 (e.g. production token on a staging host) is logged with the host, and degrades gracefully", async () => {
    process.env.DELHIVERY_BASE_URL = "https://staging-express.delhivery.com";
    fetchMock.mockResolvedValue(new Response("Login or API Key Required", { status: 401 }));
    const { checkServiceability } = await load();

    const result = await checkServiceability("135001");

    expect(result).toMatchObject({ serviceable: false, error: "Unable to check serviceability. Please try again." });
    expect(fetchMock).toHaveBeenCalledTimes(1); // auth errors are not retried
    const logged = String(vi.mocked(console.error).mock.calls[0]?.[1]);
    expect(logged).toContain("DELHIVERY_AUTH_ERROR");
    expect(logged).toContain("https://staging-express.delhivery.com");
    expect(logged).not.toContain(DUMMY_TOKEN);
  });

  it("tolerates a trailing slash on DELHIVERY_BASE_URL", async () => {
    process.env.DELHIVERY_BASE_URL = "https://track.delhivery.com/";
    fetchMock.mockResolvedValue(json(FIXTURE_135001));
    const { checkServiceability } = await load();

    expect((await checkServiceability("135001")).serviceable).toBe(true);
    expect(fetchMock.mock.calls[0][0]).toBe("https://track.delhivery.com/c/api/pin-codes/json/?filter_codes=135001");
  });

  it("treats an empty DELHIVERY_BASE_URL as unset (production host) instead of a config error", async () => {
    process.env.DELHIVERY_BASE_URL = "";
    fetchMock.mockResolvedValue(json(FIXTURE_135001));
    const { checkServiceability } = await load();

    expect((await checkServiceability("135001")).serviceable).toBe(true);
    expect(fetchMock.mock.calls[0][0]).toMatch(/^https:\/\/track\.delhivery\.com\/c\/api\//);
  });
});

describe("non-serviceable pincodes stay serviceable:false (not an error)", () => {
  it("NSZ: empty delivery_codes", async () => {
    fetchMock.mockResolvedValue(json({ delivery_codes: [] }));
    const { checkServiceability } = await load();

    const result = await checkServiceability("999999");

    expect(result.serviceable).toBe(false);
    expect(result.error).toBe("Pincode not found in Delhivery network");
  });

  it("NSZ: pincode listed with prepaid and COD both 'N'", async () => {
    const nsz = structuredClone(FIXTURE_135001);
    Object.assign(nsz.delivery_codes[0].postal_code, { pre_paid: "N", cod: "N", pickup: "N", remarks: "NSZ" });
    fetchMock.mockResolvedValue(json(nsz));
    const { checkServiceability } = await load();

    const result = await checkServiceability("135001");

    expect(result.serviceable).toBe(false);
    expect(result.availableServices).toEqual([]);
    expect(result.error).toBeUndefined();
  });
});
