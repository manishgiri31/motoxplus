import { describe, expect, it, vi } from "vitest";
import {
  EMPTY_DRAFT,
  buildFormData,
  buildPayload,
  firstInvalidStep,
  maskAccountNumber,
  stepForField,
  submitRegistration,
  validateDocument,
  validateStep,
  type RegistrationDraft,
} from "./registration";

const pdf = (name = "a.pdf", size = 1000) => new File([new Uint8Array(size)], name, { type: "application/pdf" });

// GSTIN 27 + PAN + 1Z5 : characters 3-12 equal the PAN.
const PAN = "ABCDE1234F";
const GSTIN = `27${PAN}1Z5`;

function validDraft(over: Partial<RegistrationDraft> = {}): RegistrationDraft {
  return {
    ...EMPTY_DRAFT,
    fullName: "Ravi Kumar", mobile: "+91 98765 43210", email: "Ravi@Example.com",
    password: "Tr1cky-Horse-9", confirmPassword: "Tr1cky-Horse-9",
    businessName: "Kumar Auto Parts", businessType: "WHOLESALER", pan: PAN, gstin: GSTIN,
    address: "12 Spare Market Road", state: "Maharashtra", city: "Pune", pincode: "411001",
    categoryIds: ["cat_brakes"], vehicleSegments: ["MOTORCYCLE", "SCOOTER"], vehicleBrands: ["Hero", "Honda"], productBrands: "Minda, Rico",
    skuRange: "200_1000",
    accountHolder: "Kumar Auto Parts", bankName: "HDFC Bank", accountNumber: "123456789012", ifsc: "HDFC0001234",
    warehouseAddress: "Plot 4, Industrial Estate", warehousePincode: "411019", pickupContact: "9876543210",
    files: { panDocument: pdf("pan.pdf"), gstCertificate: pdf("gst.pdf"), bankProof: pdf("cheque.pdf") },
    agreementAccepted: true,
    ...over,
  };
}

describe("step validation", () => {
  it("accepts a complete, valid application", () => {
    expect(firstInvalidStep(validDraft())).toBeNull();
  });

  it("account: requires every field and a policy-compliant, matching password", () => {
    const e = validateStep("account", EMPTY_DRAFT);
    expect(Object.keys(e).sort()).toEqual(["confirmPassword", "email", "fullName", "mobile", "password"]);

    expect(validateStep("account", validDraft({ mobile: "12345" })).mobile).toMatch(/valid/);
    expect(validateStep("account", validDraft({ email: "nope" })).email).toBeTruthy();
    expect(validateStep("account", validDraft({ password: "short", confirmPassword: "short" })).password).toMatch(/at least 8/);
    expect(validateStep("account", validDraft({ confirmPassword: "Different-9" })).confirmPassword).toMatch(/do not match/);
    // a password built from the applicant's own name is rejected, like the server does
    expect(validateStep("account", validDraft({ password: "Ravikumar123", confirmPassword: "Ravikumar123" })).password).toBeTruthy();
  });

  it("account: accepts +91 / spaced mobile numbers", () => {
    expect(validateStep("account", validDraft({ mobile: "+91 98765 43210" }))).toEqual({});
    expect(validateStep("account", validDraft({ mobile: "09876543210" }))).toEqual({});
  });

  it("business: PAN/GSTIN/pincode formats, lowercase input tolerated", () => {
    expect(validateStep("business", validDraft({ pan: "abcde1234f", gstin: GSTIN.toLowerCase() }))).toEqual({});
    expect(validateStep("business", validDraft({ pan: "ABCDE12345" })).pan).toBeTruthy();
    expect(validateStep("business", validDraft({ gstin: "27ABCDE1234F" })).gstin).toBeTruthy();
    expect(validateStep("business", validDraft({ pincode: "012345" })).pincode).toBeTruthy();
    expect(validateStep("business", validDraft({ businessType: "" })).businessType).toBeTruthy();
  });

  it("business: GSTIN is optional, but if given it must contain the entered PAN", () => {
    expect(validateStep("business", validDraft({ gstin: "" }))).toEqual({});
    expect(validateStep("business", validDraft({ pan: "ZZZZZ9999Z" })).gstin).toMatch(/does not belong/);
  });

  it("products: needs categories, vehicle segments, vehicle brands, brands and SKU range", () => {
    const e = validateStep("products", EMPTY_DRAFT);
    expect(Object.keys(e).sort()).toEqual(["categoryIds", "productBrands", "skuRange", "vehicleBrands", "vehicleSegments"]);
    expect(validateStep("products", validDraft({ vehicleSegments: ["BICYCLE"] })).vehicleSegments).toBeTruthy();
    expect(validateStep("products", validDraft({ vehicleBrands: ["Other"], otherVehicleBrand: "" })).otherVehicleBrand).toBeTruthy();
  });

  it("bank: account number digits only, IFSC shape, warehouse and pickup contact required", () => {
    expect(validateStep("bank", validDraft({ accountNumber: "12AB" })).accountNumber).toBeTruthy();
    expect(validateStep("bank", validDraft({ accountNumber: "12345678" })).accountNumber).toBeTruthy(); // 8 digits
    expect(validateStep("bank", validDraft({ ifsc: "HDFC1001234" })).ifsc).toBeTruthy(); // 5th char must be 0
    expect(validateStep("bank", validDraft({ ifsc: "hdfc0001234" }))).toEqual({});
    expect(validateStep("bank", validDraft({ pickupContact: "" })).pickupContact).toBeTruthy();
    expect(Object.keys(validateStep("bank", EMPTY_DRAFT)).length).toBe(7);
  });

  it("documents: PAN doc + bank proof always required, GST certificate only when a GSTIN is given", () => {
    const base = validDraft({ files: {} });
    expect(validateStep("documents", base)).toMatchObject({ panDocument: expect.any(String), gstCertificate: expect.any(String), bankProof: expect.any(String) });
    const noGst = validDraft({ gstin: "", files: { panDocument: pdf(), bankProof: pdf() } });
    expect(validateStep("documents", noGst)).toEqual({});
  });

  it("documents: rejects bad type, oversize, empty, over-total, and a missing agreement", () => {
    const exe = new File([new Uint8Array(10)], "x.exe", { type: "application/octet-stream" });
    expect(validateStep("documents", validDraft({ files: { panDocument: exe, bankProof: pdf(), gstCertificate: pdf() } })).panDocument).toMatch(/Unsupported/);
    expect(validateDocument("panDocument", { name: "a.pdf", size: 6 * 1024 * 1024, type: "application/pdf" })).toMatch(/too large/);
    expect(validateDocument("panDocument", { name: "a.pdf", size: 0, type: "application/pdf" })).toMatch(/empty/);
    // browsers report "" for .csv; accepted by extension, but a .csv is not a valid PAN document
    expect(validateDocument("catalogue", { name: "stock.csv", size: 100, type: "" })).toBeNull();
    expect(validateDocument("panDocument", { name: "stock.csv", size: 100, type: "" })).toMatch(/Unsupported/);
    const big = (n: string) => new File([new Uint8Array(4.9 * 1024 * 1024)], n, { type: "application/pdf" });
    const heavy = validDraft({ files: { panDocument: big("a.pdf"), gstCertificate: big("b.pdf"), bankProof: big("c.pdf"), businessProof: big("d.pdf") } });
    expect(validateStep("documents", heavy).form).toMatch(/total/);
    expect(validateStep("documents", validDraft({ agreementAccepted: false })).agreementAccepted).toBeTruthy();
  });

  it("firstInvalidStep walks the steps in order", () => {
    expect(firstInvalidStep(validDraft({ ifsc: "bad" }))?.step).toBe("bank");
    expect(firstInvalidStep(validDraft({ email: "bad", ifsc: "bad" }))?.step).toBe("account");
  });

  it("stepForField routes server errors to the owning step", () => {
    expect(stepForField("email")).toBe("account");
    expect(stepForField("gstin")).toBe("business");
    expect(stepForField("ifsc")).toBe("bank");
    expect(stepForField("panDocument")).toBe("documents");
    expect(stepForField("catalogue")).toBe("products");
  });
});

describe("request building", () => {
  it("normalises values and nulls the optional ones", () => {
    const p = buildPayload(validDraft({ gstin: "", monthlyCapacity: "  ", mobile: "+91 98765 43210", email: " Ravi@Example.com " }), "v3");
    expect(p).toMatchObject({
      mobile: "9876543210", email: "ravi@example.com", gstin: null, monthlyCapacity: null,
      productBrands: ["Minda", "Rico"], categoryIds: ["cat_brakes"], vehicleSegments: ["MOTORCYCLE", "SCOOTER"],
      bank: { ifsc: "HDFC0001234", accountNumber: "123456789012" },
      warehouse: { pickupContact: "9876543210" },
      agreement: { accepted: true, version: "v3" },
    });
  });

  it("sends the payload as a JSON part and each file as its own part", async () => {
    const fd = buildFormData(validDraft(), "v3");
    expect([...fd.keys()].sort()).toEqual(["bankProof", "gstCertificate", "panDocument", "payload"]);
    const payload = JSON.parse(await (fd.get("payload") as Blob).text());
    expect(payload.businessName).toBe("Kumar Auto Parts");
    expect((fd.get("panDocument") as File).name).toBe("pan.pdf");
  });

  it("masks the account number for the review screen", () => {
    expect(maskAccountNumber("123456789012")).toBe("••••••••9012");
    expect(maskAccountNumber("123")).toBe("123");
  });
});

describe("submitRegistration - never reports success it did not get", () => {
  const draft = validDraft();
  const res = (status: number, body?: unknown, headers?: Record<string, string>) =>
    new Response(body === undefined ? null : JSON.stringify(body), { status, headers });
  const run = (r: Response | Error) =>
    submitRegistration(draft, "v1", (r instanceof Error ? vi.fn().mockRejectedValue(r) : vi.fn().mockResolvedValue(r)) as unknown as typeof fetch);

  it("201 with a userId is the only success", async () => {
    const out = await run(res(201, { userId: "u1", vendorId: "v1", status: "PENDING_VERIFICATION" }));
    expect(out).toEqual({ ok: true, data: { userId: "u1", vendorId: "v1", status: "PENDING_VERIFICATION" } });
  });

  it("a 2xx without a userId is NOT a success", async () => {
    for (const body of [{}, { userId: "" }, { userId: 5 }, undefined]) {
      const out = await run(res(200, body));
      expect(out.ok).toBe(false);
    }
  });

  it("missing endpoint / gateway errors are 'unavailable', not success", async () => {
    for (const s of [404, 405, 501, 502, 503, 504]) {
      const out = await run(res(s));
      expect(out).toMatchObject({ ok: false, kind: "unavailable" });
    }
  });

  it("network failure", async () => {
    expect(await run(new TypeError("fetch failed"))).toMatchObject({ ok: false, kind: "network" });
  });

  it("server validation errors carry field errors back to the form", async () => {
    const out = await run(res(400, { error: "Validation failed", code: "VALIDATION_FAILED", fieldErrors: { email: "Email already registered" } }));
    expect(out).toMatchObject({ ok: false, kind: "validation", fieldErrors: { email: "Email already registered" } });
  });

  it("conflict, rate limit, unexpected 5xx", async () => {
    expect(await run(res(409, { error: "Mobile number already registered" }))).toMatchObject({ kind: "conflict", message: "Mobile number already registered" });
    expect(await run(res(429, { error: "Too many requests", retryAfterSeconds: 45 }))).toMatchObject({ kind: "rate_limited", retryAfterSeconds: 45 });
    expect(await run(res(500, { error: "boom" }))).toMatchObject({ ok: false, kind: "server" });
  });

  it("never sends the registration request with auth retry (public endpoint)", async () => {
    const f = vi.fn().mockResolvedValue(res(401, { error: "x" }));
    await submitRegistration(draft, "v1", f as unknown as typeof fetch);
    expect(f).toHaveBeenCalledTimes(1);
    expect(f.mock.calls[0][0]).toBe("/api/v1/vendors/register");
  });
});
