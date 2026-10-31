import { describe, it, expect, vi, beforeEach } from "vitest";

// Tracking/cancel/carrier-status are B2C-token calls on track.delhivery.com.
// For a B2B-channel order the gate must refuse with a clear reason and must
// never reach classifyCarrierTier (which would call Delhivery with the B2C token).

const classifyMock = vi.fn();
vi.mock("@/lib/delhivery/carrier-cancellation", () => ({
  classifyCarrierTier: (...a: unknown[]) => classifyMock(...a),
}));
vi.mock("./cancellation-policy", () => ({
  getCarrierStaleDays: async () => 3,
  getCancellationPolicy: async () => ({ preShipChargePercent: 2, postShipChargePercent: 20 }),
}));
vi.mock("@/lib/prisma", () => ({ prisma: {} }));

const { resolveDealerGate, buildCancellationQuote } = await import("./cancellation-gate");
const { B2B_CARRIER_ACTION_UNSUPPORTED_MESSAGE } = await import("@/lib/delhivery/errors");

// MANIFESTED + fresh => the local check is inconclusive and WOULD hit the carrier.
const order = (channel: string) => ({
  id: "o1",
  status: "PROCESSING",
  channel,
  paymentType: "ADVANCE_20",
  grandTotal: 1000,
  amountPaid: 200,
  shipment: { waybill: "AWB1", status: "MANIFESTED", createdAt: new Date() },
  schemeRedemption: null,
});

beforeEach(() => {
  vi.clearAllMocks();
  classifyMock.mockResolvedValue({ tier: "PRE_SHIP", rawStatusText: "Not Picked", rawStatusCode: "" });
});

describe("cancellation gate — B2B channel", () => {
  it("dealer gate: B2B is blocked with the clear message and the carrier is never called", async () => {
    const r = await resolveDealerGate(order("B2B"));
    expect(r).toEqual({ reason: B2B_CARRIER_ACTION_UNSUPPORTED_MESSAGE });
    expect(classifyMock).not.toHaveBeenCalled();
  });

  it("admin quote: B2B returns allowed:false with the clear message, carrier never called", async () => {
    const r = await buildCancellationQuote(order("B2B"), false);
    expect(r).toMatchObject({ allowed: false, reason: B2B_CARRIER_ACTION_UNSUPPORTED_MESSAGE });
    expect(classifyMock).not.toHaveBeenCalled();
  });

  it("B2C still takes the normal carrier path (unchanged behaviour)", async () => {
    const r = await resolveDealerGate(order("B2C"));
    expect(r).toBeNull();
    expect(classifyMock).toHaveBeenCalledWith("AWB1");
  });
});
