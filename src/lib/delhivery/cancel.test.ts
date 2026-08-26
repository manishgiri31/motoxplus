import { describe, it, expect, beforeEach, afterEach, vi } from "vitest";

// cancel.ts calls getDelhiveryConfig() directly (not through client.ts, which
// every other test file mocks instead). config.ts's real validation is lazy
// now, so this mock isn't strictly required to avoid a throw — but it's kept
// so tests don't depend on real env vars being set under vitest.
vi.mock("./config", () => ({
  getDelhiveryConfig: () => ({
    token: "test-token-1234567890123456789",
    baseUrl: "https://track.delhivery.com",
    pickup: {
      name: "Test Pickup Co",
      address: "Test Address",
      city: "Test City",
      state: "Test State",
      phone: "9999999999",
      pincode: "110046",
      locationName: "Test Location",
    },
    companyGst: "07AAUCM5765B1Z4",
    clientName: "test-client",
  }),
}));

import { cancelDelhiveryShipment } from "./cancel";

const ORIGINAL_FETCH = global.fetch;

function xmlResponse(status: number, body: string): Response {
  return new Response(body, { status, headers: { "Content-Type": "application/xml" } });
}

beforeEach(() => {
  vi.resetAllMocks();
});

afterEach(() => {
  global.fetch = ORIGINAL_FETCH;
});

describe("cancelDelhiveryShipment", () => {
  it("parses the real captured fresh-cancel XML response", async () => {
    // Transcribed verbatim from delhivery-reference.md, "5. Cancel" (2026-08-24).
    const raw =
      '<?xml version="1.0" encoding="utf-8"?>' +
      "<root><status>True</status><waybill>57930810000066</waybill>" +
      "<order_id>CAPTURE-1787596016179</order_id>" +
      "<remark>Shipment has been cancelled.</remark></root>";
    global.fetch = vi.fn(async () => xmlResponse(200, raw)) as unknown as typeof fetch;

    const result = await cancelDelhiveryShipment("57930810000066");

    expect(result).toEqual({
      accepted: true,
      waybill: "57930810000066",
      remark: "Shipment has been cancelled.",
    });
  });

  it("returns an IDENTICAL result for a repeat cancel on an already-cancelled AWB (idempotency, capture-confirmed)", async () => {
    // Transcribed verbatim from delhivery-reference.md, "7. Cancel again"
    // (2026-08-24) — same shape, same remark, no "already cancelled" marker.
    const raw =
      '<?xml version="1.0" encoding="utf-8"?>' +
      "<root><status>True</status><waybill>57930810000066</waybill>" +
      "<order_id>CAPTURE-1787596016179</order_id>" +
      "<remark>Shipment has been cancelled.</remark></root>";
    global.fetch = vi.fn(async () => xmlResponse(200, raw)) as unknown as typeof fetch;

    const first = await cancelDelhiveryShipment("57930810000066");
    const second = await cancelDelhiveryShipment("57930810000066");

    expect(first).toEqual(second);
    expect(second.accepted).toBe(true);
  });

  it("does not send Accept: application/json (matches the captured working request exactly)", async () => {
    const raw =
      "<root><status>True</status><waybill>X</waybill><order_id>Y</order_id><remark>ok</remark></root>";
    const fetchMock = vi.fn(async () => xmlResponse(200, raw)) as unknown as typeof fetch;
    global.fetch = fetchMock;

    await cancelDelhiveryShipment("X");

    const [, options] = (fetchMock as unknown as ReturnType<typeof vi.fn>).mock.calls[0];
    const headers = options.headers as Record<string, string>;
    expect(headers.Accept).toBeUndefined();
    expect(headers["Content-Type"]).toBe("application/json");
  });

  it("sends the JSON body {waybill, cancellation:'true'} — form-encoding rules from create.json do not apply here", async () => {
    const raw = "<root><status>True</status><waybill>X</waybill><remark>ok</remark></root>";
    const fetchMock = vi.fn(async () => xmlResponse(200, raw)) as unknown as typeof fetch;
    global.fetch = fetchMock;

    await cancelDelhiveryShipment("X");

    const [, options] = (fetchMock as unknown as ReturnType<typeof vi.fn>).mock.calls[0];
    expect(JSON.parse(options.body as string)).toEqual({ waybill: "X", cancellation: "true" });
  });

  it("decodes XML entities in the remark rather than leaving them raw", async () => {
    const raw =
      "<root><status>True</status><waybill>X</waybill>" +
      "<remark>Cancelled &amp; refunded &lt;test&gt;</remark></root>";
    global.fetch = vi.fn(async () => xmlResponse(200, raw)) as unknown as typeof fetch;

    const result = await cancelDelhiveryShipment("X");

    expect(result.remark).toBe("Cancelled & refunded <test>");
  });

  it("throws on a non-ok HTTP response rather than silently returning accepted:false", async () => {
    global.fetch = vi.fn(async () => xmlResponse(500, "<root><error>boom</error></root>")) as unknown as typeof fetch;

    await expect(cancelDelhiveryShipment("X")).rejects.toThrow(/Delhivery cancel API error 500/);
  });
});
