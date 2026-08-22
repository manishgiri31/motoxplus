import { describe, it, expect, beforeEach, afterEach, vi } from "vitest";

const ENV_KEYS = [
  "SMS_PROVIDER",
  "MSG91_AUTH_KEY",
  "MSG91_OTP_TEMPLATE_ID",
  "TWILIO_ACCOUNT_SID",
  "TWILIO_AUTH_TOKEN",
  "FAST2SMS_API_KEY",
  "WHATSAPP_ACCESS_TOKEN",
  "WHATSAPP_PHONE_NUMBER_ID",
] as const;

const ORIGINAL_ENV: Record<string, string | undefined> = {};
for (const key of ENV_KEYS) ORIGINAL_ENV[key] = process.env[key];
const ORIGINAL_FETCH = global.fetch;

vi.mock("@/lib/logger", () => ({
  logger: { error: () => {}, warn: () => {}, info: () => {}, debug: () => {} },
}));

function jsonResponse(status: number, body: unknown): Response {
  return new Response(JSON.stringify(body), { status, headers: { "Content-Type": "application/json" } });
}

beforeEach(() => {
  for (const key of ENV_KEYS) delete process.env[key];
});

afterEach(() => {
  for (const key of ENV_KEYS) {
    if (ORIGINAL_ENV[key] === undefined) delete process.env[key];
    else process.env[key] = ORIGINAL_ENV[key];
  }
  global.fetch = ORIGINAL_FETCH;
  vi.unstubAllEnvs();
  vi.restoreAllMocks();
});

describe("sendOTP dispatch — dev-skip fallback per selected provider", () => {
  it("dev-skips (never calls the network) when msg91 is selected with no credentials", async () => {
    process.env.SMS_PROVIDER = "msg91";
    const fetchSpy = vi.fn();
    global.fetch = fetchSpy as unknown as typeof fetch;
    const { sendOTP } = await import("./index");

    const result = await sendOTP("9876543210", "123456");
    expect(result).toEqual({ success: true, messageId: "dev-skip" });
    expect(fetchSpy).not.toHaveBeenCalled();
  });

  it("dev-skips when twilio is selected with no credentials (does not fall through to msg91)", async () => {
    process.env.SMS_PROVIDER = "twilio";
    const fetchSpy = vi.fn();
    global.fetch = fetchSpy as unknown as typeof fetch;
    const { sendOTP } = await import("./index");

    const result = await sendOTP("9876543210", "123456");
    expect(result).toEqual({ success: true, messageId: "dev-skip" });
    expect(fetchSpy).not.toHaveBeenCalled();
  });

  it("dispatches to Twilio once its own credentials are set — regressive check for the bug where the gate only ever checked MSG91_AUTH_KEY", async () => {
    process.env.SMS_PROVIDER = "twilio";
    process.env.TWILIO_ACCOUNT_SID = "ACxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxx";
    process.env.TWILIO_AUTH_TOKEN = "sometoken";
    const fetchSpy = vi.fn(async (_url: string, _init?: RequestInit) => jsonResponse(200, { sid: "SMxxx" }));
    global.fetch = fetchSpy as unknown as typeof fetch;
    const { sendOTP } = await import("./index");

    const result = await sendOTP("9876543210", "123456");
    expect(fetchSpy).toHaveBeenCalledTimes(1);
    expect(String(fetchSpy.mock.calls[0][0])).toContain("api.twilio.com");
    expect(result.success).toBe(true);
  });

  it("dev-skips when whatsapp is selected with no credentials", async () => {
    process.env.SMS_PROVIDER = "whatsapp";
    const fetchSpy = vi.fn();
    global.fetch = fetchSpy as unknown as typeof fetch;
    const { sendOTP } = await import("./index");

    const result = await sendOTP("9876543210", "123456");
    expect(result).toEqual({ success: true, messageId: "dev-skip" });
    expect(fetchSpy).not.toHaveBeenCalled();
  });

  it("dispatches to the WhatsApp Cloud API once its credentials are set, with the phone normalized to E.164 (no '+')", async () => {
    process.env.SMS_PROVIDER = "whatsapp";
    process.env.WHATSAPP_ACCESS_TOKEN = "waTokenValue";
    process.env.WHATSAPP_PHONE_NUMBER_ID = "1234567890";

    let capturedUrl = "";
    let capturedBody!: { to: string; template: { components: Array<{ parameters: Array<{ text: string }> }> } };
    global.fetch = vi.fn(async (url: string, init?: RequestInit) => {
      capturedUrl = url;
      capturedBody = JSON.parse(init?.body as string);
      return jsonResponse(200, { messages: [{ id: "wamid.xyz" }] });
    }) as unknown as typeof fetch;

    const { sendOTP } = await import("./index");
    const result = await sendOTP("9876543210", "482913");

    expect(result).toEqual({ success: true, messageId: "wamid.xyz" });
    expect(capturedUrl).toContain("graph.facebook.com");
    expect(capturedUrl).toContain("1234567890/messages");
    expect(capturedBody.to).toBe("919876543210");
    expect(capturedBody.template.components[0].parameters[0].text).toBe("482913");
  });

  it("still dev-skips msg91 when only the OTP template ID is a placeholder (existing behavior preserved)", async () => {
    process.env.SMS_PROVIDER = "msg91";
    process.env.MSG91_AUTH_KEY = "realkey";
    process.env.MSG91_OTP_TEMPLATE_ID = "your_msg91_otp_template_id";
    const fetchSpy = vi.fn();
    global.fetch = fetchSpy as unknown as typeof fetch;
    const { sendOTP } = await import("./index");

    const result = await sendOTP("9876543210", "123456");
    expect(result).toEqual({ success: true, messageId: "dev-skip" });
    expect(fetchSpy).not.toHaveBeenCalled();
  });

  it("never prints the OTP via console in production, even on dev-skip", async () => {
    process.env.SMS_PROVIDER = "whatsapp";
    vi.stubEnv("NODE_ENV", "production");
    const warnSpy = vi.spyOn(console, "warn").mockImplementation(() => {});
    const { sendOTP } = await import("./index");

    await sendOTP("9876543210", "123456");
    expect(warnSpy).not.toHaveBeenCalled();
  });
});
