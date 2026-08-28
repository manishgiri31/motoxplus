import { describe, it, expect } from "vitest";
import {
  isPreShipCarrierStatus,
  isCarrierStatusUnusable,
  POST_PICKUP_SHIPMENT_STATUSES,
} from "./carrier-status";

// Fixtures transcribed verbatim from delhivery-reference.md (live captures on
// AWB 57930810000066, 2026-08-24/25).
describe("isPreShipCarrierStatus — verified captures", () => {
  it("treats a freshly manifested parcel as pre-ship", () => {
    expect(
      isPreShipCarrierStatus({ statusText: "Manifested", statusCode: "X-UCI", pickedUpDate: null })
    ).toBe(true);
  });

  it("treats 'Not Picked' (pre-pickup, X-PNP) as pre-ship — the F-17 gap", () => {
    expect(
      isPreShipCarrierStatus({ statusText: "Not Picked", statusCode: "X-PNP", pickedUpDate: null })
    ).toBe(true);
  });

  it("treats a seller-cancelled-before-pickup parcel (DTUP-210, still 'Not Picked') as pre-ship", () => {
    expect(
      isPreShipCarrierStatus({ statusText: "Not Picked", statusCode: "DTUP-210", pickedUpDate: null })
    ).toBe(true);
  });
});

describe("isPreShipCarrierStatus — fails closed", () => {
  it("is NOT pre-ship once PickedupDate is set, regardless of status text", () => {
    expect(
      isPreShipCarrierStatus({ statusText: "Manifested", statusCode: "X-UCI", pickedUpDate: "2026-08-25T10:00:00" })
    ).toBe(false);
  });

  it("is NOT pre-ship for in-transit / OFD / delivered / RTO", () => {
    for (const statusText of ["In Transit", "Dispatched", "Out for Delivery", "Delivered", "RTO Initiated"]) {
      expect(isPreShipCarrierStatus({ statusText, statusCode: "", pickedUpDate: null })).toBe(false);
    }
  });

  it("is NOT pre-ship for an unknown / empty status (no positive evidence)", () => {
    expect(isPreShipCarrierStatus({ statusText: "", statusCode: "", pickedUpDate: null })).toBe(false);
    expect(isPreShipCarrierStatus({ statusText: "Some New Delhivery Status", statusCode: "Z-XYZ", pickedUpDate: null })).toBe(false);
  });

  it("is case- and whitespace-insensitive on the text", () => {
    expect(isPreShipCarrierStatus({ statusText: "  not picked  ", statusCode: "", pickedUpDate: null })).toBe(true);
    expect(isPreShipCarrierStatus({ statusText: "MANIFESTED", statusCode: "", pickedUpDate: null })).toBe(true);
  });
});

describe("isCarrierStatusUnusable", () => {
  it("is unusable when null or when both fields are blank", () => {
    expect(isCarrierStatusUnusable(null)).toBe(true);
    expect(isCarrierStatusUnusable({ statusText: "", statusCode: "  ", pickedUpDate: null })).toBe(true);
  });

  it("is usable when either field carries a signal", () => {
    expect(isCarrierStatusUnusable({ statusText: "Manifested", statusCode: "", pickedUpDate: null })).toBe(false);
    expect(isCarrierStatusUnusable({ statusText: "", statusCode: "X-UCI", pickedUpDate: null })).toBe(false);
  });
});

describe("POST_PICKUP_SHIPMENT_STATUSES", () => {
  it("covers everything at/after pickup and excludes PENDING/MANIFESTED", () => {
    for (const s of ["PICKED_UP", "IN_TRANSIT", "OUT_FOR_DELIVERY", "DELIVERED", "FAILED_DELIVERY", "RETURNED", "CANCELLED"]) {
      expect(POST_PICKUP_SHIPMENT_STATUSES.has(s)).toBe(true);
    }
    expect(POST_PICKUP_SHIPMENT_STATUSES.has("PENDING")).toBe(false);
    expect(POST_PICKUP_SHIPMENT_STATUSES.has("MANIFESTED")).toBe(false);
  });
});
