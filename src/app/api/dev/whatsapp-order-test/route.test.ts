import { describe, it, expect, vi, beforeEach, afterEach } from "vitest";
import { NextRequest } from "next/server";

// POST /api/dev/whatsapp-order-test sends REAL WhatsApp messages for a real
// order. It must be unreachable (404) everywhere except NODE_ENV=development,
// and the 404 must happen before the session check or any side effect.

const sendTemplateMock = vi.fn();
vi.mock("@/lib/whatsapp/send-template", () => ({ sendTemplate: (...a: unknown[]) => sendTemplateMock(...a) }));

const loadOrderMock = vi.fn();
vi.mock("@/lib/whatsapp/order-notifications", () => ({
  ORDER_TEMPLATES: {},
  buildTemplateValues: vi.fn(),
  loadOrderForWhatsApp: (...a: unknown[]) => loadOrderMock(...a),
}));

const getServerSessionMock = vi.fn();
vi.mock("next-auth", () => ({ getServerSession: (...a: unknown[]) => getServerSessionMock(...a) }));
vi.mock("@/lib/auth", () => ({ authOptions: {} }));
vi.mock("@/lib/phone", () => ({ toWhatsAppPhone: vi.fn() }));

import { POST } from "./route";

const adminSession = { user: { id: "u1", role: "SUPER_ADMIN" } };

function req() {
  return new NextRequest("http://localhost/api/dev/whatsapp-order-test", {
    method: "POST",
    headers: { "content-type": "application/json" },
    body: JSON.stringify({ orderId: "order_1", phone: "9876543210" }),
  });
}

beforeEach(() => {
  sendTemplateMock.mockReset();
  loadOrderMock.mockReset();
  getServerSessionMock.mockReset();
  // Even a fully authorised admin must not get through outside development.
  getServerSessionMock.mockResolvedValue(adminSession);
});

afterEach(() => {
  vi.unstubAllEnvs();
});

describe("POST /api/dev/whatsapp-order-test", () => {
  it.each(["production", "test", "staging"])("returns 404 with no WhatsApp call when NODE_ENV=%s, even for an admin", async (env) => {
    vi.stubEnv("NODE_ENV", env);
    const res = await POST(req());
    expect(res.status).toBe(404);
    expect(await res.text()).toBe("");
    expect(sendTemplateMock).not.toHaveBeenCalled();
    expect(loadOrderMock).not.toHaveBeenCalled();
  });

  it("checks the environment before auth: no session lookup happens in production", async () => {
    vi.stubEnv("NODE_ENV", "production");
    await POST(req());
    expect(getServerSessionMock).not.toHaveBeenCalled();
  });

  it("returns 404 when NODE_ENV is unset", async () => {
    vi.stubEnv("NODE_ENV", undefined as unknown as string);
    const res = await POST(req());
    expect(res.status).toBe(404);
    expect(sendTemplateMock).not.toHaveBeenCalled();
  });

  it("in development it still requires an admin session (401 for anonymous, no WhatsApp call)", async () => {
    vi.stubEnv("NODE_ENV", "development");
    getServerSessionMock.mockResolvedValue(null);
    const res = await POST(req());
    expect(res.status).toBe(401);
    expect(sendTemplateMock).not.toHaveBeenCalled();
    expect(loadOrderMock).not.toHaveBeenCalled();
  });
});
