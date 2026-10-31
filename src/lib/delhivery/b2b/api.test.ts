import { describe, it, expect, vi, beforeEach, afterEach } from "vitest";
import { resetB2bAuthState } from "./auth";
import { requestB2bPickup } from "./pickup";
import { submitB2bManifest, type B2bManifestInput } from "./manifest";
import { getB2bManifestStatus } from "./manifest-status";
import { registerB2bWarehouse, type B2bWarehouseInput } from "./warehouse";
import { getB2bConfig } from "./config";
import { buildB2bManifestInput, b2bBoxCount, B2B_FREIGHT_MODE, type B2bOrderFacts } from "./order-mapping";
import { DelhiveryB2bAuthError, DelhiveryB2bProdManifestBlockedError, DelhiveryConfigError, DelhiveryNotSpecifiedError } from "../errors";

// All HTTP is mocked: the first fetch of each test is the /ums/login call, the
// rest are the API call under test. Credentials/tokens are dummy strings.

const fetchMock = vi.fn();
const ENV = { ...process.env };

function res(status: number, body: unknown = {}) {
  return new Response(typeof body === "string" ? body : JSON.stringify(body), { status });
}
// Structurally valid JWT (unsigned) expiring in 24h — login reads exp from the payload.
const b64 = (o: unknown) => Buffer.from(JSON.stringify(o)).toString("base64url");
const JWT = `${b64({ alg: "none" })}.${b64({ exp: Math.floor(Date.now() / 1000) + 86400 })}.sig`;
const LOGIN_OK = () => res(200, { data: { jwt: JWT } });

beforeEach(() => {
  vi.stubGlobal("fetch", fetchMock);
  fetchMock.mockReset();
  resetB2bAuthState();
  Object.assign(process.env, {
    DELHIVERY_USERNAME_B2B: "test-user",
    DELHIVERY_PASSWORD_B2B: "test-pass",
    DELHIVERY_PICKUP_LOCATION_B2B: "WH-B2B",
  });
  delete process.env.DELHIVERY_B2B_BASE_URL;
});
afterEach(() => {
  vi.unstubAllGlobals();
  process.env = { ...ENV };
});

describe("B2B pickup — POST /pickup_requests/", () => {
  it("sends the exact spec body (client_warehouse = DELHIVERY_PICKUP_LOCATION_B2B), Bearer JWT, to the LTL host with the trailing slash", async () => {
    fetchMock.mockResolvedValueOnce(LOGIN_OK()).mockResolvedValueOnce(res(200, { ok: true }));

    await requestB2bPickup({ pickupDate: "2026-11-02", startTime: "16:00:00", expectedPackageCount: 3 });

    const [url, init] = fetchMock.mock.calls[1];
    expect(url).toBe("https://ltl-clients-api.delhivery.com/pickup_requests/");
    expect(init.method).toBe("POST");
    expect(init.headers.Authorization).toBe(`Bearer ${JWT}`);
    expect(init.headers["Content-Type"]).toBe("application/json");
    expect(JSON.parse(init.body)).toEqual({
      client_warehouse: "WH-B2B",
      pickup_date: "2026-11-02",
      start_time: "16:00:00",
      expected_package_count: 3,
    });
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
  dropoffLocation: { consignee_name: "C", address: "A", city: "Ci", state: "St", zip: "110045", phone: "9999999999", email: "" },
  invoices: [{ ewaybill: "", inv_num: "MX-1", inv_amt: 5000, inv_qr_code: "" }],
  shipmentDetails: [{ order_id: "MX-1", box_count: 1, description: "Part x2", weight: 12500, waybills: [], master: false }],
  freightMode: "fop",
  fmPickup: true,
};

describe("B2B manifest - POST /manifest (multipart)", () => {
  beforeEach(() => {
    // dev host: no prod gate
    process.env.DELHIVERY_B2B_BASE_URL = "https://ltl-clients-api-dev.example.test";
  });

  it("sends every spec field as multipart/form-data with Bearer JWT and returns job_id", async () => {
    fetchMock.mockResolvedValueOnce(LOGIN_OK()).mockResolvedValueOnce(res(200, { job_id: "job-123" }));

    const out = await submitB2bManifest(MANIFEST_BASE);

    expect(out).toEqual({ jobId: "job-123" });
    const [url, init] = fetchMock.mock.calls[1];
    expect(url).toBe("https://ltl-clients-api-dev.example.test/manifest");
    expect(init.method).toBe("POST");
    expect(init.headers.Authorization).toBe(`Bearer ${JWT}`);
    expect(init.headers["Content-Type"]).toBeUndefined(); // fetch sets the multipart boundary itself
    const form = init.body as FormData;
    expect(form).toBeInstanceOf(FormData);
    expect(form.get("pickup_location_name")).toBe("WH-B2B");
    expect(form.get("payment_mode")).toBe("prepaid");
    expect(form.get("weight")).toBe("12500");
    expect(JSON.parse(form.get("dropoff_location") as string)).toEqual(MANIFEST_BASE.dropoffLocation);
    expect(JSON.parse(form.get("invoices") as string)).toEqual(MANIFEST_BASE.invoices);
    expect(JSON.parse(form.get("shipment_details") as string)).toEqual(MANIFEST_BASE.shipmentDetails);
    expect(form.get("freight_mode")).toBe("fop");
    expect(form.get("fm_pickup")).toBe("true");
  });

  it("rov_insurance: key is ABSENT unless the input carries it (non retail/co-loader)", async () => {
    fetchMock.mockImplementation(async () => res(200, { job_id: "j" }));
    fetchMock.mockImplementationOnce(async () => LOGIN_OK());

    await submitB2bManifest(MANIFEST_BASE);
    expect((fetchMock.mock.calls[1][1].body as FormData).has("rov_insurance")).toBe(false);

    await submitB2bManifest({ ...MANIFEST_BASE, rovInsurance: "rov-value" });
    expect((fetchMock.mock.calls[2][1].body as FormData).get("rov_insurance")).toBe("rov-value");
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

describe("B2B manifest - production gate (dev job_id must be seen first)", () => {
  beforeEach(() => {
    delete process.env.DELHIVERY_B2B_BASE_URL; // default = prod host
    delete process.env.DELHIVERY_B2B_PROD_MANIFEST_VERIFIED;
  });

  it("refuses on the prod host and makes NO network call (not even login)", async () => {
    await expect(submitB2bManifest(MANIFEST_BASE)).rejects.toBeInstanceOf(DelhiveryB2bProdManifestBlockedError);
    expect(fetchMock).not.toHaveBeenCalled();
  });

  it("only DELHIVERY_B2B_PROD_MANIFEST_VERIFIED=true opens it", async () => {
    process.env.DELHIVERY_B2B_PROD_MANIFEST_VERIFIED = "yes";
    await expect(submitB2bManifest(MANIFEST_BASE)).rejects.toBeInstanceOf(DelhiveryB2bProdManifestBlockedError);

    process.env.DELHIVERY_B2B_PROD_MANIFEST_VERIFIED = "true";
    fetchMock.mockResolvedValueOnce(LOGIN_OK()).mockResolvedValueOnce(res(200, { job_id: "j" }));
    expect((await submitB2bManifest(MANIFEST_BASE)).jobId).toBe("j");
    expect(fetchMock.mock.calls[1][0]).toBe("https://ltl-clients-api.delhivery.com/manifest");
  });

  it("a dev host is never gated", async () => {
    process.env.DELHIVERY_B2B_BASE_URL = "https://ltl-clients-api-dev.example.test";
    fetchMock.mockResolvedValueOnce(LOGIN_OK()).mockResolvedValueOnce(res(200, { job_id: "j" }));
    expect((await submitB2bManifest(MANIFEST_BASE)).jobId).toBe("j");
  });
});

describe("B2B manifest status — GET /manifest", () => {
  it("TODO(spec) pinned: queries ?job_id=<id> — the format is UNCONFIRMED, update this test with the real one", async () => {
    fetchMock.mockResolvedValueOnce(LOGIN_OK()).mockResolvedValueOnce(res(200, { raw: true }));

    const out = await getB2bManifestStatus("job 1/2");

    const [url, init] = fetchMock.mock.calls[1];
    expect(url).toBe("https://ltl-clients-api.delhivery.com/manifest?job_id=job%201%2F2");
    expect(init.method).toBe("GET");
    expect(init.headers.Authorization).toBe(`Bearer ${JWT}`);
    expect(out).toEqual({ raw: true }); // raw body, shape unspecified
  });
});

const WAREHOUSE: B2bWarehouseInput = {
  name: "TEST-WH",
  pin_code: "110045",
  city: "New Delhi",
  state: "Delhi",
  country: "India",
  address_details: { address: "addr", contact_person: "person", phone_number: "9999999999" },
  ret_address: { pin: "110045", address: "ret addr" },
  pick_up_days: ["mon"],
  pick_up_hours: "10-18",
  business_days: ["mon"],
  business_hours: "10-18",
};

describe("B2B warehouse — POST /client-warehouse/create/", () => {
  it("sends the exact payload and returns data.result.name on data.success", async () => {
    fetchMock
      .mockResolvedValueOnce(LOGIN_OK())
      .mockResolvedValueOnce(res(200, { data: { success: true, result: { name: "TEST-WH" } } }));

    const out = await registerB2bWarehouse(WAREHOUSE);

    expect(out).toEqual({ name: "TEST-WH", alreadyExisted: false });
    const [url, init] = fetchMock.mock.calls[1];
    expect(url).toBe("https://ltl-clients-api.delhivery.com/client-warehouse/create/");
    expect(init.method).toBe("POST");
    expect(init.headers.Authorization).toBe(`Bearer ${JWT}`);
    expect(JSON.parse(init.body)).toEqual(WAREHOUSE);
  });

  it('treats "already exists" as success (error status)', async () => {
    fetchMock.mockResolvedValueOnce(LOGIN_OK()).mockResolvedValueOnce(res(400, "Warehouse already exists"));
    expect(await registerB2bWarehouse(WAREHOUSE)).toEqual({ name: "TEST-WH", alreadyExisted: true });
  });

  it('treats "already exists" as success (HTTP 200, success:false)', async () => {
    fetchMock
      .mockResolvedValueOnce(LOGIN_OK())
      .mockResolvedValueOnce(res(200, { data: { success: false, error: "client warehouse Already Exists" } }));
    expect(await registerB2bWarehouse(WAREHOUSE)).toEqual({ name: "TEST-WH", alreadyExisted: true });
  });

  it("any other failure is an error, not a silent success", async () => {
    fetchMock.mockResolvedValueOnce(LOGIN_OK()).mockResolvedValueOnce(res(200, { data: { success: false, error: "invalid pin" } }));
    await expect(registerB2bWarehouse(WAREHOUSE)).rejects.toThrow(/did not report success/);
    fetchMock.mockResolvedValueOnce(res(500, "boom"));
    await expect(registerB2bWarehouse(WAREHOUSE)).rejects.toThrow(/500/);
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
    delete process.env.DELHIVERY_USERNAME_B2B;
    delete process.env.DELHIVERY_PASSWORD_B2B;
    delete process.env.DELHIVERY_PICKUP_LOCATION_B2B;
    expect(() => getB2bConfig()).toThrow(/USERNAME[\s\S]*PASSWORD[\s\S]*PICKUP_LOCATION_B2B/);
  });
});

const FACTS: B2bOrderFacts = {
  orderNumber: "MX-100",
  grandTotal: 5000,
  amountDue: 0,
  consignee: { name: "Dealer Co", address: "12 Main Rd", city: "Hisar", state: "Haryana", pincode: "125001", phone: "9876543210", email: "d@example.com" },
  items: [
    { name: "Mudguard", quantity: 2, weightKg: 1.5 },
    { name: "Cable", quantity: 1, weightKg: 0.25 },
  ],
};

describe("B2B order mapping (docs curl structures)", () => {
  beforeEach(() => {
    delete process.env.DELHIVERY_B2B_RETAIL_COLOADER;
    delete process.env.DELHIVERY_B2B_ROV_INSURANCE;
  });

  it("builds dropoff_location / invoices / shipment_details exactly", () => {
    const m = buildB2bManifestInput(FACTS);

    expect(m.dropoffLocation).toEqual({
      consignee_name: "Dealer Co",
      address: "12 Main Rd",
      city: "Hisar",
      state: "Haryana",
      zip: "125001",
      phone: "9876543210",
      email: "d@example.com",
    });
    expect(m.invoices).toEqual([{ ewaybill: "", inv_num: "MX-100", inv_amt: 5000, inv_qr_code: "" }]);
    expect(m.shipmentDetails).toEqual([
      { order_id: "MX-100", box_count: 1, description: "Mudguard x2, Cable x1", weight: 3250, waybills: [], master: false },
    ]);
    expect(m.weightGrams).toBe(3250); // grams: 2 x 1.5kg + 0.25kg
    expect(m.fmPickup).toBe(true);
    expect(m.freightMode).toBe(B2B_FREIGHT_MODE);
    expect(B2B_FREIGHT_MODE).toBe("fop");
    expect(m.pickupLocationName).toBe("WH-B2B");
  });

  it("prepaid (amountDue 0): no cod_amount", () => {
    const m = buildB2bManifestInput({ ...FACTS, amountDue: 0 });
    expect(m.paymentMode).toBe("prepaid");
    expect(m).not.toHaveProperty("codAmount");
  });

  it("ADVANCE_20 balance (amountDue 4000 of 5000): cod with cod_amount = amountDue; invoice stays the order total", () => {
    const m = buildB2bManifestInput({ ...FACTS, amountDue: 4000 });
    expect(m.paymentMode).toBe("cod");
    expect(m.codAmount).toBe(4000);
    expect(m.invoices[0].inv_amt).toBe(5000);
  });

  it("COD (amountDue == total): cod_amount is the whole total", () => {
    const m = buildB2bManifestInput({ ...FACTS, amountDue: 5000 });
    expect(m).toMatchObject({ paymentMode: "cod", codAmount: 5000 });
  });

  it("rov_insurance is NOT in the manifest by default (retail/co-loader flag is false)", () => {
    expect(buildB2bManifestInput(FACTS)).not.toHaveProperty("rovInsurance");
  });

  it("with DELHIVERY_B2B_RETAIL_COLOADER=true, rov_insurance carries the configured value", () => {
    process.env.DELHIVERY_B2B_RETAIL_COLOADER = "true";
    process.env.DELHIVERY_B2B_ROV_INSURANCE = "rov-value";
    expect(buildB2bManifestInput(FACTS).rovInsurance).toBe("rov-value");
  });

  it("retail/co-loader without a configured rov_insurance value is a config error, not a guess", () => {
    process.env.DELHIVERY_B2B_RETAIL_COLOADER = "true";
    expect(() => buildB2bManifestInput(FACTS)).toThrow(DelhiveryConfigError);
    expect(() => buildB2bManifestInput(FACTS)).toThrow(/DELHIVERY_B2B_ROV_INSURANCE/);
  });

  it("the ROV value alone (flag off) is ignored", () => {
    process.env.DELHIVERY_B2B_ROV_INSURANCE = "rov-value";
    expect(buildB2bManifestInput(FACTS)).not.toHaveProperty("rovInsurance");
  });

  it("pickup expected_package_count = sum of shipment_details.box_count", () => {
    const m = buildB2bManifestInput(FACTS);
    expect(b2bBoxCount(m.shipmentDetails)).toBe(1);
    expect(b2bBoxCount([...m.shipmentDetails, { ...m.shipmentDetails[0], box_count: 3 }])).toBe(4);
  });
});
