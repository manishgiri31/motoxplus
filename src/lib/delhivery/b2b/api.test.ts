import { describe, it, expect, vi, beforeEach, afterEach } from "vitest";
import { resetB2bAuthState } from "./auth";
import { requestB2bPickup } from "./pickup";
import { submitB2bManifest, type B2bManifestInput } from "./manifest";
import { getB2bManifestStatus } from "./manifest-status";
import { registerB2bWarehouse } from "./warehouse";
import { getB2bConfig } from "./config";
import { b2bKnownManifestFields, buildB2bManifestInput } from "./order-mapping";
import { DelhiveryB2bAuthError, DelhiveryConfigError, DelhiveryNotSpecifiedError } from "../errors";

// All HTTP is mocked: the first fetch of each test is the /ums/login call, the
// rest are the API call under test. Credentials/tokens are dummy strings.

const fetchMock = vi.fn();
const ENV = { ...process.env };

function res(status: number, body: unknown = {}) {
  return new Response(typeof body === "string" ? body : JSON.stringify(body), { status });
}
const LOGIN_OK = () => res(200, { jwt: "tok-test" });

beforeEach(() => {
  vi.stubGlobal("fetch", fetchMock);
  fetchMock.mockReset();
  resetB2bAuthState();
  Object.assign(process.env, {
    DELHIVERY_B2B_USERNAME: "test-user",
    DELHIVERY_B2B_PASSWORD: "test-pass",
    DELHIVERY_B2B_TOKEN_FIELD: "jwt",
    DELHIVERY_PICKUP_LOCATION_B2B: "WH-B2B",
  });
  delete process.env.DELHIVERY_B2B_BASE_URL;
  delete process.env.DELHIVERY_B2B_CLIENT_WAREHOUSE;
});
afterEach(() => {
  vi.unstubAllGlobals();
  process.env = { ...ENV };
});

describe("B2B pickup — POST /pickup_requests/", () => {
  it("sends the exact spec body, Bearer JWT, to the LTL host with the trailing slash", async () => {
    fetchMock.mockResolvedValueOnce(LOGIN_OK()).mockResolvedValueOnce(res(200, { ok: true }));

    await requestB2bPickup({ pickupDate: "2026-11-02", startTime: "16:00:00", expectedPackageCount: 3 });

    const [url, init] = fetchMock.mock.calls[1];
    expect(url).toBe("https://ltl-clients-api.delhivery.com/pickup_requests/");
    expect(init.method).toBe("POST");
    expect(init.headers.Authorization).toBe("Bearer tok-test");
    expect(init.headers["Content-Type"]).toBe("application/json");
    expect(JSON.parse(init.body)).toEqual({
      client_warehouse: "WH-B2B",
      pickup_date: "2026-11-02",
      start_time: "16:00:00",
      expected_package_count: 3,
    });
  });

  it("uses DELHIVERY_B2B_CLIENT_WAREHOUSE when it differs from the location name", async () => {
    process.env.DELHIVERY_B2B_CLIENT_WAREHOUSE = "WH-OTHER";
    fetchMock.mockResolvedValueOnce(LOGIN_OK()).mockResolvedValueOnce(res(200, {}));
    await requestB2bPickup({ pickupDate: "2026-11-02", startTime: "16:00:00", expectedPackageCount: 1 });
    expect(JSON.parse(fetchMock.mock.calls[1][1].body).client_warehouse).toBe("WH-OTHER");
  });

  it("rejects malformed date/time/count before any network call", async () => {
    await expect(requestB2bPickup({ pickupDate: "02-11-2026", startTime: "16:00:00", expectedPackageCount: 1 })).rejects.toThrow(/YYYY-MM-DD/);
    await expect(requestB2bPickup({ pickupDate: "2026-11-02", startTime: "4pm", expectedPackageCount: 1 })).rejects.toThrow(/HH:MM:SS/);
    await expect(requestB2bPickup({ pickupDate: "2026-11-02", startTime: "16:00:00", expectedPackageCount: 0 })).rejects.toThrow(/positive integer/);
    expect(fetchMock).not.toHaveBeenCalled();
  });

  it("a 401 drops the cached JWT (next call logs in again) and is not retried", async () => {
    fetchMock
      .mockResolvedValueOnce(LOGIN_OK())
      .mockResolvedValueOnce(res(401, "expired"))
      .mockResolvedValueOnce(LOGIN_OK())
      .mockResolvedValueOnce(res(200, {}));
    const input = { pickupDate: "2026-11-02", startTime: "16:00:00", expectedPackageCount: 1 };

    await expect(requestB2bPickup(input)).rejects.toBeInstanceOf(DelhiveryB2bAuthError);
    expect(fetchMock).toHaveBeenCalledTimes(2); // login + one pickup attempt, no retry

    await requestB2bPickup(input);
    expect(fetchMock).toHaveBeenCalledTimes(4); // re-login + pickup
  });

  it("a non-2xx API response throws with the status", async () => {
    fetchMock.mockResolvedValueOnce(LOGIN_OK()).mockResolvedValueOnce(res(400, "bad warehouse"));
    await expect(
      requestB2bPickup({ pickupDate: "2026-11-02", startTime: "16:00:00", expectedPackageCount: 1 })
    ).rejects.toThrow(/400[\s\S]*bad warehouse/);
  });
});

const MANIFEST_BASE: B2bManifestInput = {
  pickupLocationName: "WH-B2B",
  paymentMode: "prepaid",
  weightGrams: 12500.4,
  dropoffLocation: { any: "shape" },
  invoices: [{ any: 1 }],
  shipmentDetails: [{ any: 2 }],
  freightMode: "fm-value",
  fmPickup: "fm-pickup-value",
  rovInsurance: "rov-value",
};

describe("B2B manifest — POST /manifest (multipart)", () => {
  it("sends every spec field as multipart/form-data with Bearer JWT and returns job_id", async () => {
    fetchMock.mockResolvedValueOnce(LOGIN_OK()).mockResolvedValueOnce(res(200, { job_id: "job-123" }));

    const out = await submitB2bManifest(MANIFEST_BASE);

    expect(out).toEqual({ jobId: "job-123" });
    const [url, init] = fetchMock.mock.calls[1];
    expect(url).toBe("https://ltl-clients-api.delhivery.com/manifest");
    expect(init.method).toBe("POST");
    expect(init.headers.Authorization).toBe("Bearer tok-test");
    expect(init.headers["Content-Type"]).toBeUndefined(); // fetch sets the multipart boundary itself
    const form = init.body as FormData;
    expect(form).toBeInstanceOf(FormData);
    expect(form.get("pickup_location_name")).toBe("WH-B2B");
    expect(form.get("payment_mode")).toBe("prepaid");
    expect(form.get("weight")).toBe("12500");
    expect(JSON.parse(form.get("dropoff_location") as string)).toEqual({ any: "shape" });
    expect(JSON.parse(form.get("invoices") as string)).toEqual([{ any: 1 }]);
    expect(JSON.parse(form.get("shipment_details") as string)).toEqual([{ any: 2 }]);
    expect(form.get("freight_mode")).toBe("fm-value");
    expect(form.get("fm_pickup")).toBe("fm-pickup-value");
    expect(form.get("rov_insurance")).toBe("rov-value");
  });

  it("prepaid: cod_amount is not sent; cod: it is", async () => {
    fetchMock.mockImplementation(async () => res(200, { job_id: "j" })); // fresh Response per call
    fetchMock.mockImplementationOnce(async () => LOGIN_OK());

    await submitB2bManifest(MANIFEST_BASE);
    expect((fetchMock.mock.calls[1][1].body as FormData).has("cod_amount")).toBe(false);

    await submitB2bManifest({ ...MANIFEST_BASE, paymentMode: "cod", codAmount: 4000 });
    const cod = fetchMock.mock.calls[2][1].body as FormData;
    expect(cod.get("payment_mode")).toBe("cod");
    expect(cod.get("cod_amount")).toBe("4000");
  });

  it("cod without a positive cod_amount is refused before any network call", async () => {
    await expect(submitB2bManifest({ ...MANIFEST_BASE, paymentMode: "cod" })).rejects.toThrow(/cod_amount/);
    await expect(submitB2bManifest({ ...MANIFEST_BASE, paymentMode: "cod", codAmount: 0 })).rejects.toThrow(/cod_amount/);
    expect(fetchMock).not.toHaveBeenCalled();
  });

  it("a response without job_id is a clear error that lists key names", async () => {
    fetchMock.mockResolvedValueOnce(LOGIN_OK()).mockResolvedValueOnce(res(200, { status: "queued" }));
    const err = await submitB2bManifest(MANIFEST_BASE).catch((e) => e);
    expect(err).toBeInstanceOf(DelhiveryNotSpecifiedError);
    expect(err.message).toContain("job_id");
    expect(err.message).toContain("status");
  });
});

describe("B2B manifest status — GET /manifest", () => {
  it("TODO(spec) pinned: queries ?job_id=<id> — the format is UNCONFIRMED, update this test with the real one", async () => {
    fetchMock.mockResolvedValueOnce(LOGIN_OK()).mockResolvedValueOnce(res(200, { raw: true }));

    const out = await getB2bManifestStatus("job 1/2");

    const [url, init] = fetchMock.mock.calls[1];
    expect(url).toBe("https://ltl-clients-api.delhivery.com/manifest?job_id=job%201%2F2");
    expect(init.method).toBe("GET");
    expect(init.headers.Authorization).toBe("Bearer tok-test");
    expect(out).toEqual({ raw: true }); // raw body, shape unspecified
  });
});

describe("B2B warehouse", () => {
  it("is deliberately unimplemented (no spec) and sends nothing", async () => {
    await expect(registerB2bWarehouse()).rejects.toBeInstanceOf(DelhiveryNotSpecifiedError);
    expect(fetchMock).not.toHaveBeenCalled();
  });
});

describe("B2B config", () => {
  it("defaults to the production LTL host and trims a trailing slash from overrides", () => {
    expect(getB2bConfig().baseUrl).toBe("https://ltl-clients-api.delhivery.com");
    process.env.DELHIVERY_B2B_BASE_URL = "https://ltl-clients-api-dev.delhivery.com/";
    expect(getB2bConfig().baseUrl).toBe("https://ltl-clients-api-dev.delhivery.com");
  });

  it("refuses the B2C host so B2B traffic can never reach it", () => {
    process.env.DELHIVERY_B2B_BASE_URL = "https://track.delhivery.com";
    expect(() => getB2bConfig()).toThrow(DelhiveryConfigError);
    expect(() => getB2bConfig()).toThrow(/track\.delhivery\.com/);
  });

  it("lists every missing required var", () => {
    delete process.env.DELHIVERY_B2B_USERNAME;
    delete process.env.DELHIVERY_B2B_PASSWORD;
    delete process.env.DELHIVERY_PICKUP_LOCATION_B2B;
    expect(() => getB2bConfig()).toThrow(/USERNAME[\s\S]*PASSWORD[\s\S]*PICKUP_LOCATION_B2B/);
  });
});

describe("B2B order mapping", () => {
  it("prepaid when nothing is owed at delivery; weight kg -> grams", () => {
    expect(b2bKnownManifestFields({ orderNumber: "MX-1", amountDue: 0, totalWeightKg: 12.5 })).toEqual({
      pickupLocationName: "WH-B2B",
      paymentMode: "prepaid",
      weightGrams: 12500,
    });
  });

  it("cod with cod_amount = the balance owed (ADVANCE_20)", () => {
    expect(b2bKnownManifestFields({ orderNumber: "MX-1", amountDue: 4000, totalWeightKg: 1 })).toMatchObject({
      paymentMode: "cod",
      codAmount: 4000,
    });
  });

  it("refuses to build the unspecified fields instead of guessing them", () => {
    expect(() => buildB2bManifestInput({ orderNumber: "MX-1", amountDue: 0, totalWeightKg: 1 })).toThrow(DelhiveryNotSpecifiedError);
    expect(() => buildB2bManifestInput({ orderNumber: "MX-1", amountDue: 0, totalWeightKg: 1 })).toThrow(
      /dropoff_location, invoices, shipment_details/
    );
  });
});
