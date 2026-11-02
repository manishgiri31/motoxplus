import { logger } from "@/lib/logger";

// Same Meta app / phone number as the OTP provider (lib/sms/providers/whatsapp.ts),
// so the same env vars. Only the language differs: order templates are
// approved under plain "en".
const GRAPH_API_VERSION = process.env.WHATSAPP_GRAPH_API_VERSION || "v25.0";
const TEMPLATE_LANGUAGE = process.env.WHATSAPP_ORDER_TEMPLATE_LANGUAGE || "en";
const REQUEST_TIMEOUT_MS = 10_000;

// Meta rejects a body parameter that is empty, contains newlines/tabs, or has
// 4+ consecutive spaces, and caps it at 1024 characters.
const MAX_PARAM_LENGTH = 1024;

export class WhatsAppSendError extends Error {
  constructor(
    message: string,
    readonly metaCode?: number,
    readonly status?: number
  ) {
    super(message);
    this.name = "WhatsAppSendError";
  }
}

function toParam(value: unknown): { type: "text"; text: string } {
  const text = String(value).replace(/\s+/g, " ").trim().slice(0, MAX_PARAM_LENGTH);
  return { type: "text", text: text || "-" };
}

// Meta's error message can quote request details; make sure no phone number
// or the access token survives into logs.
function scrub(message: string | undefined, token: string): string | undefined {
  return message?.split(token).join("[redacted]").replace(/\d{10,}/g, "[redacted]");
}

/**
 * Sends an approved WhatsApp template whose body takes `values` as positional
 * {{1}}..{{n}} text parameters, in order. `phone` must already be in
 * country-code-without-plus form (see toWhatsAppPhone in lib/phone.ts).
 *
 * Throws WhatsAppSendError on any failure so the caller decides what to do —
 * order flows wrap this in try/catch (see lib/whatsapp/order-notifications.ts)
 * so a failed message never blocks an order status update. Never logs the
 * token or the recipient.
 */
export async function sendTemplate(
  phone: string,
  templateName: string,
  values: unknown[]
): Promise<{ messageId: string }> {
  const token = process.env.WHATSAPP_ACCESS_TOKEN || "";
  const phoneNumberId = process.env.WHATSAPP_PHONE_NUMBER_ID || "";
  if (!token || !phoneNumberId) throw new WhatsAppSendError("WhatsApp credentials not configured");
  if (!/^\d{11,15}$/.test(phone)) throw new WhatsAppSendError("Recipient number must be digits only, with country code");

  const controller = new AbortController();
  const timeout = setTimeout(() => controller.abort(), REQUEST_TIMEOUT_MS);

  try {
    const res = await fetch(`https://graph.facebook.com/${GRAPH_API_VERSION}/${phoneNumberId}/messages`, {
      method: "POST",
      headers: { Authorization: `Bearer ${token}`, "Content-Type": "application/json" },
      body: JSON.stringify({
        messaging_product: "whatsapp",
        recipient_type: "individual",
        to: phone,
        type: "template",
        template: {
          name: templateName,
          language: { code: TEMPLATE_LANGUAGE },
          components: [{ type: "body", parameters: values.map(toParam) }],
        },
      }),
      signal: controller.signal,
    });

    const data = await res.json().catch(() => undefined);
    const messageId = data?.messages?.[0]?.id;
    if (res.ok && messageId) {
      logger.info("[WhatsApp] Template accepted", { template: templateName, messageId });
      return { messageId };
    }

    const err = data?.error;
    logger.error("[WhatsApp] Template send failed", {
      template: templateName,
      status: res.status,
      code: err?.code,
      subcode: err?.error_subcode,
      type: err?.type,
      message: scrub(typeof err?.message === "string" ? err.message : undefined, token),
      details: scrub(typeof err?.error_data?.details === "string" ? err.error_data.details : undefined, token),
      fbtrace_id: err?.fbtrace_id,
    });
    throw new WhatsAppSendError(`WhatsApp template "${templateName}" send failed`, err?.code, res.status);
  } catch (err) {
    if (err instanceof WhatsAppSendError) throw err;
    const aborted = err instanceof Error && err.name === "AbortError";
    logger.error("[WhatsApp] Template request failed", {
      template: templateName,
      reason: aborted ? "timeout" : err instanceof Error ? scrub(err.message, token) : "unknown",
    });
    throw new WhatsAppSendError(aborted ? "WhatsApp API request timed out" : "WhatsApp API request failed");
  } finally {
    clearTimeout(timeout);
  }
}
