import { describe, it, expect, beforeEach, vi } from "vitest";
import { isServiceable, checkServiceability } from "./serviceability";
import { delhiveryFetch } from "./client";
import type { DelhiveryPincodeResponse } from "./types";

vi.mock("./client", () => ({
  delhiveryFetch: vi.fn(),
}));

// Transcribed exactly from the live-captured response for pincode 135001 —
// delhivery-reference.md, "1. Pincode serviceability", 2026-08-23.
const SERVICEABLE_FIXTURE: DelhiveryPincodeResponse = {
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
        center: [
          {
            code: "IND135001AAA",
            e: "2019-03-14T10:29:36.678",
            cn: "YamunaNagar_DC (Haryana)",
            s: "2015-04-23T19:16:36.970",
            u: "Aayush.Agarwal",
            ud: "2015-04-23T19:16:36.970",
            sort_code: "JUD/JUD",
          },
        ],
        city: "Yamuna Nagar",
        sun_tat: true,
        protect_blacklist: false,
        srv_wt_th: 4500.0,
      },
    },
  ],
};

const UNSERVICEABLE_FIXTURE: DelhiveryPincodeResponse = { delivery_codes: [] };

beforeEach(() => {
  vi.resetAllMocks();
});

describe("isServiceable", () => {
  it("parses the real captured response into full capability info", async () => {
    vi.mocked(delhiveryFetch).mockResolvedValue(SERVICEABLE_FIXTURE);

    const result = await isServiceable("135001");

    expect(result).toEqual({
      pincode: "135001",
      serviceable: true,
      prepaid: true,
      cod: true,
      pickup: true,
      cashOnPickup: true,
      replacement: true,
      isOda: false,
      city: "Yamuna Nagar",
      district: "Yamuna Nagar",
    });
  });

  it("returns null (not an error) for an empty delivery_codes array", async () => {
    vi.mocked(delhiveryFetch).mockResolvedValue(UNSERVICEABLE_FIXTURE);

    const result = await isServiceable("999999");

    expect(result).toBeNull();
  });

  it("returns null when delivery_codes is present but has no postal_code entry", async () => {
    vi.mocked(delhiveryFetch).mockResolvedValue({ delivery_codes: [{}] } as unknown as DelhiveryPincodeResponse);

    const result = await isServiceable("999999");

    expect(result).toBeNull();
  });

  it("throws on a malformed pincode without calling the API", async () => {
    await expect(isServiceable("12345")).rejects.toThrow(/6 digits/);
    expect(delhiveryFetch).not.toHaveBeenCalled();
  });

  it("reflects mixed capability flags (e.g. COD-only pincode)", async () => {
    const codOnly: DelhiveryPincodeResponse = {
      delivery_codes: [
        {
          postal_code: {
            ...SERVICEABLE_FIXTURE.delivery_codes[0].postal_code,
            pre_paid: "N",
            cod: "Y",
          },
        },
      ],
    };
    vi.mocked(delhiveryFetch).mockResolvedValue(codOnly);

    const result = await isServiceable("135001");

    expect(result?.serviceable).toBe(true);
    expect(result?.prepaid).toBe(false);
    expect(result?.cod).toBe(true);
  });
});

describe("checkServiceability", () => {
  it("maps a serviceable pincode to the public ServiceabilityResult shape", async () => {
    vi.mocked(delhiveryFetch).mockResolvedValue(SERVICEABLE_FIXTURE);

    const result = await checkServiceability("135001");

    expect(result).toEqual({
      serviceable: true,
      estimatedDeliveryDays: 3,
      availableServices: ["Prepaid", "COD", "Pickup"],
      city: "Yamuna Nagar",
      state: null,
    });
  });

  it("returns a graceful unserviceable result for an empty delivery_codes array", async () => {
    vi.mocked(delhiveryFetch).mockResolvedValue(UNSERVICEABLE_FIXTURE);

    const result = await checkServiceability("999999");

    expect(result.serviceable).toBe(false);
    expect(result.error).toBe("Pincode not found in Delhivery network");
  });

  it("rejects a malformed pincode before calling the API", async () => {
    const result = await checkServiceability("12345");

    expect(result.serviceable).toBe(false);
    expect(result.error).toBe("Invalid pincode format");
    expect(delhiveryFetch).not.toHaveBeenCalled();
  });

  it("degrades gracefully (does not throw) if the API call itself fails", async () => {
    vi.mocked(delhiveryFetch).mockRejectedValue(new Error("network error"));

    const result = await checkServiceability("135001");

    expect(result.serviceable).toBe(false);
    expect(result.error).toBe("Unable to check serviceability. Please try again.");
  });
});
