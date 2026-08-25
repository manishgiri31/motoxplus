import { describe, it, expect, beforeEach, vi } from "vitest";
import { fetchTrackingDetail, fetchLiveTracking } from "./tracking";
import { delhiveryFetch } from "./client";
import type { DelhiveryTrackResponse, DelhiveryTrackNotFoundResponse } from "./types";

vi.mock("./client", () => ({
  delhiveryFetch: vi.fn(),
}));

// Transcribed verbatim from delhivery-reference.md, "11. Track verbose=2"
// (2026-08-24) — AWB 57930810000066, cancelled before pickup.
const TRACK_VERBOSE2_FIXTURE: DelhiveryTrackResponse = {
  ShipmentData: [
    {
      Shipment: {
        AWB: "57930810000066",
        CODAmount: 0,
        ChargedWeight: null,
        Consignee: {
          Address1: [],
          Address2: [],
          Address3: "",
          City: "Yamunanagar",
          Country: "India",
          Name: "Manish Giri",
          PinCode: 135001,
          State: "Haryana",
          Telephone1: "",
          Telephone2: "",
        },
        DeliveryDate: null,
        DestRecieveDate: null,
        Destination: "Yamunanagar",
        DispatchCount: 0,
        Ewaybill: [],
        ExpectedDeliveryDate: null,
        Extras: "",
        FirstAttemptDate: null,
        InvoiceAmount: 100,
        OrderType: "Pre-paid",
        Origin: "Delhi_Airport_GW (Delhi)",
        OriginRecieveDate: null,
        OutDestinationDate: null,
        PickUpDate: "2026-08-24T23:56:59.79",
        PickedupDate: null,
        PickupLocation: "Manish Giri",
        PromisedDeliveryDate: null,
        Quantity: "1",
        RTOStartedDate: null,
        ReferenceNo: "CAPTURE-1787596016179",
        ReturnPromisedDeliveryDate: null,
        ReturnedDate: null,
        ReverseInTransit: false,
        Scans: [
          {
            ScanDetail: {
              Instructions: "Manifest uploaded",
              Scan: "Manifested",
              ScanDateTime: "2026-08-24T23:56:59.828",
              ScanType: "UD",
              ScannedLocation: "Delhi_Airport_GW (Delhi)",
              StatusCode: "X-UCI",
              StatusDateTime: "2026-08-24T23:56:59.828",
            },
          },
          {
            ScanDetail: {
              Instructions: "Shipment not received from client",
              Scan: "Not Picked",
              ScanDateTime: "2026-08-24T23:57:00.373",
              ScanType: "UD",
              ScannedLocation: "Delhi_Airport_GW (Delhi)",
              StatusCode: "X-PNP",
              StatusDateTime: "2026-08-24T23:57:00.373",
            },
          },
          {
            ScanDetail: {
              Instructions: "Seller cancelled the order",
              Scan: "Not Picked",
              ScanDateTime: "2026-08-24T23:58:39.774",
              ScanType: "UD",
              ScannedLocation: "Delhi_Airport_GW (Delhi)",
              StatusCode: "DTUP-210",
              StatusDateTime: "2026-08-24T23:58:39.774",
            },
          },
        ],
        SenderName: "c80988-MOTOXPLUSINDIAPRIVAT-do",
        Status: {
          Instructions: "Seller cancelled the order",
          RecievedBy: "",
          Status: "Not Picked",
          StatusCode: "DTUP-210",
          StatusDateTime: "2026-08-24T23:58:39.774",
          StatusLocation: "Delhi_Airport_GW (Delhi)",
          StatusType: "UD",
        },
      },
    },
  ],
};

// Transcribed verbatim from delhivery-reference.md, "9. Track verbose=0"
// (2026-08-24) — same AWB, same instant, verbose=0 only. No Scans, no
// Consignee — used to lock in the verbosity dependency (see below).
const TRACK_VERBOSE0_FIXTURE = {
  ShipmentData: [
    {
      Shipment: {
        AWB: "57930810000066",
        CODAmount: 0,
        ChargedWeight: null,
        DeliveryDate: null,
        DestRecieveDate: null,
        Destination: "Yamunanagar",
        DispatchCount: 0,
        Ewaybill: [],
        ExpectedDeliveryDate: null,
        Extras: "",
        FirstAttemptDate: null,
        InvoiceAmount: 100,
        OrderType: "Pre-paid",
        Origin: "Delhi_Airport_GW (Delhi)",
        OriginRecieveDate: null,
        OutDestinationDate: null,
        PickUpDate: "2026-08-24T23:56:59.79",
        PickedupDate: null,
        PickupLocation: "Manish Giri",
        PromisedDeliveryDate: null,
        Quantity: "1",
        RTOStartedDate: null,
        ReferenceNo: "CAPTURE-1787596016179",
        ReturnPromisedDeliveryDate: null,
        ReturnedDate: null,
        ReverseInTransit: false,
        SenderName: "c80988-MOTOXPLUSINDIAPRIVAT-do",
        Status: {
          Instructions: "Seller cancelled the order",
          RecievedBy: "",
          Status: "Not Picked",
          StatusCode: "DTUP-210",
          StatusDateTime: "2026-08-24T23:58:39.774",
          StatusLocation: "Delhi_Airport_GW (Delhi)",
          StatusType: "UD",
        },
      },
    },
  ],
};

// Transcribed verbatim from delhivery-reference.md, "12. Track, nonexistent
// AWB" (2026-08-25) — HTTP 200, not 404, and a completely different
// top-level shape.
const TRACK_NOT_FOUND_FIXTURE: DelhiveryTrackNotFoundResponse = {
  Success: false,
  Error: "Data does not exists for provided Waybill(s)",
  rmk: "Some error has occurred. Please contact client.support@delhivery.com with error message- Data does not exists for provided Waybill(s)",
};

beforeEach(() => {
  vi.resetAllMocks();
});

describe("fetchTrackingDetail", () => {
  it("parses the real captured verbose=2 response", async () => {
    vi.mocked(delhiveryFetch).mockResolvedValue(TRACK_VERBOSE2_FIXTURE);

    const result = await fetchTrackingDetail("57930810000066");

    expect(result).not.toBeNull();
    expect(result?.AWB).toBe("57930810000066");
    expect(result?.Consignee.Name).toBe("Manish Giri");
    expect(result?.Consignee.Address1).toEqual([]);
    expect(result?.Scans).toHaveLength(3);
    expect(result?.OrderType).toBe("Pre-paid");
    expect(result?.InvoiceAmount).toBe(100);
  });

  it("returns null (not an error) for an unknown AWB", async () => {
    vi.mocked(delhiveryFetch).mockResolvedValue(TRACK_NOT_FOUND_FIXTURE);

    const result = await fetchTrackingDetail("00000000000000");

    expect(result).toBeNull();
  });

  it("requests verbose=2 explicitly", async () => {
    vi.mocked(delhiveryFetch).mockResolvedValue(TRACK_VERBOSE2_FIXTURE);

    await fetchTrackingDetail("57930810000066");

    expect(delhiveryFetch).toHaveBeenCalledWith(expect.stringContaining("verbose=2"));
  });
});

describe("fetchLiveTracking", () => {
  it("reflects a cancelled (pre-pickup) shipment honestly: Status stays 'Not Picked', Instructions carries the real signal", async () => {
    vi.mocked(delhiveryFetch).mockResolvedValue(TRACK_VERBOSE2_FIXTURE);

    const result = await fetchLiveTracking("57930810000066");

    expect(result.waybill).toBe("57930810000066");
    expect(result.currentLocation).toBe("Delhi_Airport_GW (Delhi)");
    expect(result.events).toHaveLength(3);
    expect(result.events[2].activity).toBe("Seller cancelled the order");
    // normalizeShipmentStatus has no "not picked" mapping (flagged
    // separately — not fixed in this pass), so this currently falls through
    // to the generic IN_TRANSIT default rather than something cancellation-
    // specific. Asserting the actual (if unideal) behavior, not a wish.
    expect(result.status).toBe("IN_TRANSIT");
  });

  it("returns a graceful 'no tracking data' result for an unknown AWB, not a thrown error", async () => {
    vi.mocked(delhiveryFetch).mockResolvedValue(TRACK_NOT_FOUND_FIXTURE);

    const result = await fetchLiveTracking("00000000000000");

    expect(result.status).toBe("PENDING");
    expect(result.error).toBe("No tracking data");
    expect(result.events).toEqual([]);
  });

  it("LOCKS IN the verbosity dependency: a verbose=0-shaped response (no Scans) yields empty events", async () => {
    // This is not a hypothetical — production briefly ran on verbose=0
    // before this fix, which silently meant zero scan history was ever
    // populated. If a future change reverts the query string to verbose=0
    // without updating this parser, this test fails instead of silently
    // breaking scan history again.
    vi.mocked(delhiveryFetch).mockResolvedValue(TRACK_VERBOSE0_FIXTURE);

    const result = await fetchLiveTracking("57930810000066");

    expect(result.events).toEqual([]);
  });

  it("handles missing/empty Scans without throwing (constructed variant: same verified shape, zero entries — not itself a live capture)", async () => {
    const emptyScansFixture: DelhiveryTrackResponse = {
      ShipmentData: [
        {
          Shipment: {
            ...TRACK_VERBOSE2_FIXTURE.ShipmentData[0].Shipment,
            Scans: [],
          },
        },
      ],
    };
    vi.mocked(delhiveryFetch).mockResolvedValue(emptyScansFixture);

    const result = await fetchLiveTracking("57930810000066");

    expect(result.events).toEqual([]);
    expect(result.error).toBeUndefined();
  });

  it("degrades gracefully (does not throw) if the API call itself fails", async () => {
    vi.mocked(delhiveryFetch).mockRejectedValue(new Error("network error"));

    const result = await fetchLiveTracking("57930810000066");

    expect(result.error).toBe("Unable to fetch live tracking. Please try again later.");
    expect(result.events).toEqual([]);
  });
});
