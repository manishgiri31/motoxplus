import { describe, expect, it, vi } from "vitest";
import { checkDealerGstin, GSTIN_REQUIRED_MESSAGE } from "./dealer-gstin";
import type { GstinCheck } from "./verify-gstin";

const GSTIN = "27AAPFU0939F1ZV";
const result = (over: Partial<GstinCheck>): GstinCheck => ({
  gstin: GSTIN, status: "PENDING", legalName: null, tradeName: null, registrationStatus: null, principalAddress: null, ...over,
});

describe("checkDealerGstin", () => {
  it("requires a GSTIN for a dealer (B2B) account", async () => {
    const verify = vi.fn();
    expect(await checkDealerGstin("  ", verify)).toEqual({ ok: false, error: GSTIN_REQUIRED_MESSAGE, status: 400 });
    expect(verify).not.toHaveBeenCalled();
  });

  it("rejects a malformed GSTIN without calling the registry", async () => {
    const verify = vi.fn();
    const r = await checkDealerGstin("27AAPFU0939F1ZW", verify);
    expect(r).toMatchObject({ ok: false, error: "Invalid GST number" });
    expect(verify).not.toHaveBeenCalled();
  });

  it("stores registry details and marks verified only when the registry says Active", async () => {
    const r = await checkDealerGstin(GSTIN.toLowerCase(), async () =>
      result({ status: "VERIFIED", legalName: "ACME AUTO PARTS", registrationStatus: "Active", principalAddress: "Pune" })
    );
    expect(r.ok).toBe(true);
    if (!r.ok) return;
    expect(r.gstin).toBe(GSTIN);
    expect(r.dealerFields).toMatchObject({
      gstNumber: GSTIN, gstVerified: true, gstVerificationStatus: "VERIFIED", gstVerificationSource: "GST_API",
      gstLegalName: "ACME AUTO PARTS", gstRegistrationStatus: "Active", gstPrincipalAddress: "Pune",
    });
    expect(r.dealerFields.gstVerifiedAt).toBeInstanceOf(Date);
  });

  it("never treats a well-formed GSTIN as verified when the registry can't be reached", async () => {
    const r = await checkDealerGstin(GSTIN, async () => result({ status: "PENDING" }));
    expect(r.ok).toBe(true);
    if (!r.ok) return;
    expect(r.dealerFields).toMatchObject({ gstVerified: false, gstVerifiedAt: null, gstVerificationStatus: "PENDING" });
  });

  it("rejects GSTINs the registry doesn't know or reports inactive", async () => {
    const notFound = await checkDealerGstin(GSTIN, async () => result({ status: "INVALID" }));
    expect(notFound).toMatchObject({ ok: false, status: 400 });
    const cancelled = await checkDealerGstin(GSTIN, async () => result({ status: "INACTIVE", registrationStatus: "Cancelled" }));
    expect(cancelled).toMatchObject({ ok: false, status: 400 });
    if (!cancelled.ok) expect(cancelled.error).toContain("cancelled");
  });

  it("puts every rejection on the form's GSTIN field (mapServerError matches /gst/i)", async () => {
    for (const status of ["INVALID", "INACTIVE"] as const) {
      const r = await checkDealerGstin(GSTIN, async () => result({ status }));
      if (!r.ok) expect(r.error).toMatch(/gst/i);
    }
    expect(GSTIN_REQUIRED_MESSAGE).toMatch(/gst/i);
  });
});
