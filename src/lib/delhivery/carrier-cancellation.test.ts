import { describe, it, expect, vi, beforeEach } from "vitest";
import type { DelhiveryShipment } from "./types";

const fetchTrackingDetail = vi.fn();
vi.mock("./tracking", () => ({
  fetchTrackingDetail: (...args: unknown[]) => fetchTrackingDetail(...args),
}));

import { classifyCarrierTier, classifyRawCarrierStatus } from "./carrier-cancellation";

function shipmentWithStatus(status: string, code: string, pickedUpDate: string | null = null): DelhiveryShipment {
  return {
    AWB: "57930810000066",
    PickedupDate: pickedUpDate,
    Status: {
      Instructions: "",
      RecievedBy: "",
      Status: status,
      StatusCode: code,
      StatusDateTime: "2026-08-24T23:56:59.828",
      StatusLocation: "Delhi_Airport_GW (Delhi)",
      StatusType: "UD",
    },
  } as unknown as DelhiveryShipment;
}

beforeEach(() => {
  fetchTrackingDetail.mockReset();
});

describe("classifyRawCarrierStatus (pure)", () => {
  it("PRE_SHIP for manifested / not-picked", () => {
    expect(classifyRawCarrierStatus({ statusText: "Manifested", statusCode: "X-UCI", pickedUpDate: null })).toBe("PRE_SHIP");
    expect(classifyRawCarrierStatus({ statusText: "Not Picked", statusCode: "X-PNP", pickedUpDate: null })).toBe("PRE_SHIP");
  });
  it("POST_SHIP for anything past pickup", () => {
    expect(classifyRawCarrierStatus({ statusText: "In Transit", statusCode: "", pickedUpDate: null })).toBe("POST_SHIP");
    expect(classifyRawCarrierStatus({ statusText: "Manifested", statusCode: "X-UCI", pickedUpDate: "2026-08-25" })).toBe("POST_SHIP");
  });
  it("FETCH_FAILED when there is no usable status", () => {
    expect(classifyRawCarrierStatus(null)).toBe("FETCH_FAILED");
    expect(classifyRawCarrierStatus({ statusText: "", statusCode: "", pickedUpDate: null })).toBe("FETCH_FAILED");
  });
});

describe("classifyCarrierTier — one call, no retry, no writes", () => {
  it("calls fetchTrackingDetail exactly once with retries:1", async () => {
    fetchTrackingDetail.mockResolvedValue(shipmentWithStatus("Manifested", "X-UCI"));
    const result = await classifyCarrierTier("57930810000066");
    expect(result.tier).toBe("PRE_SHIP");
    expect(result.rawStatusText).toBe("Manifested");
    expect(fetchTrackingDetail).toHaveBeenCalledTimes(1);
    expect(fetchTrackingDetail).toHaveBeenCalledWith("57930810000066", { retries: 1 });
  });

  it("returns POST_SHIP for a picked-up parcel", async () => {
    fetchTrackingDetail.mockResolvedValue(shipmentWithStatus("In Transit", "S-IT", "2026-08-25T09:00:00"));
    expect((await classifyCarrierTier("x")).tier).toBe("POST_SHIP");
  });

  it("returns FETCH_FAILED when the fetch throws (fail closed)", async () => {
    fetchTrackingDetail.mockRejectedValue(new Error("network"));
    expect((await classifyCarrierTier("x")).tier).toBe("FETCH_FAILED");
  });

  it("returns FETCH_FAILED for an unknown AWB (null)", async () => {
    fetchTrackingDetail.mockResolvedValue(null);
    expect((await classifyCarrierTier("x")).tier).toBe("FETCH_FAILED");
  });
});
