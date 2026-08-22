import { describe, it, expect, beforeEach, afterEach, vi } from "vitest";

const ORIGINAL_TOKEN = process.env.WHATSAPP_ACCESS_TOKEN;
const ORIGINAL_PHONE_ID = process.env.WHATSAPP_PHONE_NUMBER_ID;
const ORIGINAL_TEMPLATE = process.env.WHATSAPP_TEMPLATE_NAME;
const ORIGINAL_LANG = process.env.WHATSAPP_TEMPLATE_LANGUAGE;
const ORIGINAL_FETCH = global.fetch;

const loggerErrorCalls: Array<[string, Record<string, unknown> | undefined]> = [];

vi.mock("@/lib/logger", () => ({
  logger: {
    error: (msg: string, meta?: Record<string, unknown>) => {
      loggerErrorCalls.push([msg, meta]);
    },
    warn: () => {},
    info: () => {},
    debug: () => {},
  },
}));

const SECRET_TOKEN = "EAAG_super_secret_token_value_123";
const OTP = "482913";

function jsonResponse(status: number, body: unknown): Response {
  return new Response(JSON.stringify(body), { status, headers: { "Content-Type": "application/json" } });
}

beforeEach(() => {
  process.env.WHATSAPP_ACCESS_TOKEN = SECRET_TOKEN;
  process.env.WHATSAPP_PHONE_NUMBER_ID = "1234567890";
  process.env.WHATSAPP_TEMPLATE_NAME = "login_otp";
  process.env.WHATSAPP_TEMPLATE_LANGUAGE = "en_US";
  loggerErrorCalls.length = 0;
});

afterEach(() => {
  process.env.WHATSAPP_ACCESS_TOKEN = ORIGINAL_TOKEN;
  process.env.WHATSAPP_PHONE_NUMBER_ID = ORIGINAL_PHONE_ID;
  process.env.WHATSAPP_TEMPLATE_NAME = ORIGINAL_TEMPLATE;
  process.env.WHATSAPP_TEMPLATE_LANGUAGE = ORIGINAL_LANG;
  global.fetch = ORIGINAL_FETCH;
  vi.restoreAllMocks();
});

describe("WhatsAppProvider — missing configuration", () => {
  it("fails without calling the network when the access token is unset", async () => {
    delete process.env.WHATSAPP_ACCESS_TOKEN;
    const { WhatsAppProvider } = await import("./whatsapp");
    const fetchSpy = vi.fn();
    global.fetch = fetchSpy as unknown as typeof fetch;

    const result = await new WhatsAppProvider().sendOTP("+919876543210", OTP);
    expect(result.success).toBe(false);
    expect(fetchSpy).not.toHaveBeenCalled();
  });

  it("fails without calling the network when the phone number ID is unset", async () => {
    delete process.env.WHATSAPP_PHONE_NUMBER_ID;
    const { WhatsAppProvider } = await import("./whatsapp");
    const fetchSpy = vi.fn();
    global.fetch = fetchSpy as unknown as typeof fetch;

    const result = await new WhatsAppProvider().sendOTP("+919876543210", OTP);
    expect(result.success).toBe(false);
    expect(fetchSpy).not.toHaveBeenCalled();
  });

  it("rejects a non-E.164 recipient before calling the network", async () => {
    const { WhatsAppProvider } = await import("./whatsapp");
    const fetchSpy = vi.fn();
    global.fetch = fetchSpy as unknown as typeof fetch;

    const result = await new WhatsAppProvider().sendOTP("9876543210", OTP);
    expect(result.success).toBe(false);
    expect(fetchSpy).not.toHaveBeenCalled();
  });
});

describe("WhatsAppProvider — successful send", () => {
  it("builds the Meta Graph API request per the current Authentication-template Copy-Code structure", async () => {
    let capturedUrl = "";
    let capturedInit: RequestInit | undefined;
    global.fetch = vi.fn(async (url: string, init?: RequestInit) => {
      capturedUrl = url;
      capturedInit = init;
      return jsonResponse(200, { messages: [{ id: "wamid.abc123" }] });
    }) as unknown as typeof fetch;

    const { WhatsAppProvider } = await import("./whatsapp");
    const result = await new WhatsAppProvider().sendOTP("+919876543210", OTP);

    expect(result).toEqual({ success: true, messageId: "wamid.abc123" });
    expect(capturedUrl).toMatch(/^https:\/\/graph\.facebook\.com\/v\d+(\.\d+)?\/1234567890\/messages$/);

    const headers = capturedInit?.headers as Record<string, string>;
    expect(headers.Authorization).toBe(`Bearer ${SECRET_TOKEN}`);
    expect(headers["Content-Type"]).toBe("application/json");

    const body = JSON.parse(capturedInit?.body as string);
    expect(body.messaging_product).toBe("whatsapp");
    expect(body.to).toBe("919876543210"); // no leading '+'
    expect(body.type).toBe("template");
    expect(body.template.name).toBe("login_otp");
    expect(body.template.language).toEqual({ code: "en_US" });

    const [bodyComponent, buttonComponent] = body.template.components;
    expect(bodyComponent).toEqual({ type: "body", parameters: [{ type: "text", text: OTP }] });
    expect(buttonComponent).toEqual({
      type: "button",
      sub_type: "url",
      index: "0",
      parameters: [{ type: "text", text: OTP }],
    });
  });

  it("uses an explicit template name override when provided", async () => {
    global.fetch = vi.fn(async () => jsonResponse(200, { messages: [{ id: "wamid.1" }] })) as unknown as typeof fetch;
    const { WhatsAppProvider } = await import("./whatsapp");
    await new WhatsAppProvider().sendOTP("+919876543210", OTP, "custom_otp_template");

    const call = (global.fetch as ReturnType<typeof vi.fn>).mock.calls[0];
    const body = JSON.parse((call[1] as RequestInit).body as string);
    expect(body.template.name).toBe("custom_otp_template");
  });
});

describe("WhatsAppProvider — Meta API failures", () => {
  it("classifies an invalid/expired access token (401) without leaking the token", async () => {
    global.fetch = vi.fn(async () =>
      jsonResponse(401, { error: { message: "Error validating access token", type: "OAuthException", code: 190 } })
    ) as unknown as typeof fetch;

    const { WhatsAppProvider } = await import("./whatsapp");
    const result = await new WhatsAppProvider().sendOTP("+919876543210", OTP);

    expect(result.success).toBe(false);
    expect(result.error).toMatch(/access token/i);
    expect(result.error).not.toContain(SECRET_TOKEN);
  });

  it("classifies a rate-limited response (429)", async () => {
    global.fetch = vi.fn(async () => jsonResponse(429, { error: { code: 4, message: "Too many requests" } })) as unknown as typeof fetch;
    const { WhatsAppProvider } = await import("./whatsapp");
    const result = await new WhatsAppProvider().sendOTP("+919876543210", OTP);
    expect(result.success).toBe(false);
    expect(result.error).toMatch(/rate limit/i);
  });

  it("classifies a missing/unapproved template", async () => {
    global.fetch = vi.fn(async () => jsonResponse(400, { error: { code: 132001, message: "Template does not exist" } })) as unknown as typeof fetch;
    const { WhatsAppProvider } = await import("./whatsapp");
    const result = await new WhatsAppProvider().sendOTP("+919876543210", OTP);
    expect(result.success).toBe(false);
    expect(result.error).toMatch(/template/i);
  });

  it("logs a safe diagnostic (status/code, never the token or OTP) on failure", async () => {
    global.fetch = vi.fn(async () =>
      jsonResponse(401, { error: { message: "Error validating access token", type: "OAuthException", code: 190 } })
    ) as unknown as typeof fetch;

    const { WhatsAppProvider } = await import("./whatsapp");
    await new WhatsAppProvider().sendOTP("+919876543210", OTP);

    expect(loggerErrorCalls.length).toBeGreaterThan(0);
    for (const [, meta] of loggerErrorCalls) {
      const serialized = JSON.stringify(meta ?? {});
      expect(serialized).not.toContain(SECRET_TOKEN);
      expect(serialized).not.toContain(OTP);
    }
  });

  it("handles a network timeout without throwing", async () => {
    global.fetch = vi.fn(() => {
      const err = new Error("aborted");
      err.name = "AbortError";
      return Promise.reject(err);
    }) as unknown as typeof fetch;

    const { WhatsAppProvider } = await import("./whatsapp");
    const result = await new WhatsAppProvider().sendOTP("+919876543210", OTP);
    expect(result.success).toBe(false);
    expect(result.error).toMatch(/timed out/i);
  });

  it("handles an arbitrary network failure without throwing", async () => {
    global.fetch = vi.fn(() => Promise.reject(new Error("ECONNRESET"))) as unknown as typeof fetch;
    const { WhatsAppProvider } = await import("./whatsapp");
    const result = await new WhatsAppProvider().sendOTP("+919876543210", OTP);
    expect(result.success).toBe(false);
  });
});

describe("WhatsAppProvider — sendSMS", () => {
  it("is unsupported (authentication templates are the only send path on this channel)", async () => {
    const { WhatsAppProvider } = await import("./whatsapp");
    const result = await new WhatsAppProvider().sendSMS("+919876543210", "hello");
    expect(result.success).toBe(false);
  });
});
