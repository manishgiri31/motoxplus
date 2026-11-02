import { describe, it, expect, beforeEach, afterEach, vi } from "vitest";

const logs: Array<[string, Record<string, unknown> | undefined]> = [];
vi.mock("@/lib/logger", () => ({
  logger: {
    error: (m: string, meta?: Record<string, unknown>) => logs.push([m, meta]),
    warn: () => {},
    info: () => {},
    debug: () => {},
  },
}));

const { sendTemplate, WhatsAppSendError } = await import("./send-template");

const TOKEN = "EAAG_secret_token_value";
const PHONE = "919876543210";
const ORIGINAL_FETCH = global.fetch;

function json(status: number, body: unknown): Response {
  return new Response(JSON.stringify(body), { status, headers: { "Content-Type": "application/json" } });
}

beforeEach(() => {
  vi.stubEnv("WHATSAPP_ACCESS_TOKEN", TOKEN);
  vi.stubEnv("WHATSAPP_PHONE_NUMBER_ID", "555000111");
  logs.length = 0;
});
afterEach(() => {
  vi.unstubAllEnvs();
  global.fetch = ORIGINAL_FETCH;
});

describe("sendTemplate", () => {
  it("posts the template with String()-ed text body parameters, in order", async () => {
    let url = "";
    let body: any;
    global.fetch = vi.fn(async (u: any, init: any) => {
      url = String(u);
      body = JSON.parse(init.body);
      return json(200, { messages: [{ id: "wamid.1" }] });
    }) as any;

    const res = await sendTemplate(PHONE, "order_cancelled", ["Asha", 1042, "Requested by customer"]);

    expect(res.messageId).toBe("wamid.1");
    expect(url).toBe("https://graph.facebook.com/v25.0/555000111/messages");
    expect(body.to).toBe(PHONE);
    expect(body.template.name).toBe("order_cancelled");
    expect(body.template.language).toEqual({ code: "en" });
    expect(body.template.components).toEqual([
      {
        type: "body",
        parameters: [
          { type: "text", text: "Asha" },
          { type: "text", text: "1042" },
          { type: "text", text: "Requested by customer" },
        ],
      },
    ]);
  });

  it("flattens newlines/tabs/runs of spaces and never sends an empty parameter", async () => {
    let body: any;
    global.fetch = vi.fn(async (_u: any, init: any) => {
      body = JSON.parse(init.body);
      return json(200, { messages: [{ id: "x" }] });
    }) as any;

    await sendTemplate(PHONE, "t", ["a\n b\t\tc      d", "   "]);
    expect(body.template.components[0].parameters.map((p: any) => p.text)).toEqual(["a b c d", "-"]);
  });

  it("throws on a Meta error and logs the error detail without the token or any phone number", async () => {
    global.fetch = vi.fn(async () =>
      json(400, {
        error: { code: 132001, type: "OAuthException", message: `Template missing for ${PHONE} using ${TOKEN}`, fbtrace_id: "abc" },
      })
    ) as any;

    const err = await sendTemplate(PHONE, "order_shipped", ["x"]).catch((e) => e);
    expect(err).toBeInstanceOf(WhatsAppSendError);
    expect(err.metaCode).toBe(132001);

    const logged = JSON.stringify(logs);
    expect(logged).toContain("132001");
    expect(logged).not.toContain(TOKEN);
    expect(logged).not.toContain(PHONE);
    expect(err.message).not.toContain(PHONE);
  });

  it("throws on a network failure", async () => {
    global.fetch = vi.fn(async () => {
      throw new Error("socket hang up");
    }) as any;
    await expect(sendTemplate(PHONE, "t", ["x"])).rejects.toBeInstanceOf(WhatsAppSendError);
  });

  it("throws without calling Meta when credentials or the number are missing/invalid", async () => {
    global.fetch = vi.fn() as any;
    await expect(sendTemplate("98765", "t", ["x"])).rejects.toThrow(/digits only/);
    vi.stubEnv("WHATSAPP_ACCESS_TOKEN", "");
    await expect(sendTemplate(PHONE, "t", ["x"])).rejects.toThrow(/not configured/);
    expect(global.fetch).not.toHaveBeenCalled();
  });
});
