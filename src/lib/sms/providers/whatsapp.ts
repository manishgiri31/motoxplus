import type { SMSProvider } from "../types";
import { logger } from "@/lib/logger";

// Overridable via env so a Graph API version bump needs no code change —
// v23.0 (May 2025) has a long support runway (until Oct 2027) and is what
// Meta's own authentication-template docs currently exemplify.
const GRAPH_API_VERSION = process.env.WHATSAPP_GRAPH_API_VERSION || "v23.0";
const DEFAULT_TEMPLATE_NAME = process.env.WHATSAPP_TEMPLATE_NAME || "login_otp";
const TEMPLATE_LANGUAGE = process.env.WHATSAPP_TEMPLATE_LANGUAGE || "en_US";

// Bounds how long a single send can hang — a wedged Graph API call must not
// block the request indefinitely.
const REQUEST_TIMEOUT_MS = 10_000;

interface MetaErrorBody {
  error?: {
    message?: string;
    type?: string;
    code?: number;
    error_subcode?: number;
    fbtrace_id?: string;
  };
}

/**
 * Maps a Meta Graph API failure to a short, safe-to-log-and-return reason.
 * Never includes the access token, the OTP, or Meta's raw response body —
 * only Meta's own numeric error code/subcode, which identify the failure
 * category (bad token, bad phone number ID, template issue, rate limit,
 * unreachable recipient) without leaking anything sensitive.
 */
function classifyMetaError(status: number, body: MetaErrorBody | undefined): string {
  const err = body?.error;
  const code = err?.code;
  const subcode = err?.error_subcode;

  if (status === 401 || code === 190) return "WhatsApp access token invalid or expired";
  if (code === 100 && subcode === 33) return "WhatsApp phone number ID invalid";
  if (code === 132000 || code === 132001) return "WhatsApp template not found or not approved";
  if (code === 132005 || code === 132012) return "WhatsApp template parameter mismatch";
  if (status === 429 || code === 4 || code === 80007) return "WhatsApp API rate limit exceeded";
  if (code === 131026) return "Recipient not reachable on WhatsApp";
  if (code === 131047) return "Recipient has not opted in to WhatsApp messages";
  if (code === 131009) return "Recipient phone number invalid";
  return "WhatsApp API request failed";
}

export class WhatsAppProvider implements SMSProvider {
  name = "WhatsApp";

  private accessToken = process.env.WHATSAPP_ACCESS_TOKEN || "";
  private phoneNumberId = process.env.WHATSAPP_PHONE_NUMBER_ID || "";

  /**
   * Sends the approved "login_otp" Authentication template (category:
   * Authentication, Copy Code button) via the WhatsApp Cloud API. The OTP is
   * passed twice per Meta's current documented structure for a copy-code
   * button send: once as the body's {{1}} parameter, once as the button's
   * index-0 parameter — the button component is what renders the tappable
   * "Copy Code" affordance in the WhatsApp client.
   */
  async sendOTP(mobile: string, otp: string, templateName?: string): Promise<{ success: boolean; messageId?: string; error?: string }> {
    if (!this.accessToken || !this.phoneNumberId) {
      return { success: false, error: "WhatsApp credentials not configured" };
    }
    if (!mobile.startsWith("+") || mobile.length < 8) {
      return { success: false, error: "Recipient number must be in E.164 format" };
    }

    const url = `https://graph.facebook.com/${GRAPH_API_VERSION}/${this.phoneNumberId}/messages`;
    const body = {
      messaging_product: "whatsapp",
      recipient_type: "individual",
      to: mobile.replace("+", ""),
      type: "template",
      template: {
        name: templateName || DEFAULT_TEMPLATE_NAME,
        language: { code: TEMPLATE_LANGUAGE },
        components: [
          {
            type: "body",
            parameters: [{ type: "text", text: otp }],
          },
          {
            type: "button",
            sub_type: "url",
            index: "0",
            parameters: [{ type: "text", text: otp }],
          },
        ],
      },
    };

    const controller = new AbortController();
    const timeout = setTimeout(() => controller.abort(), REQUEST_TIMEOUT_MS);

    try {
      const res = await fetch(url, {
        method: "POST",
        headers: {
          Authorization: `Bearer ${this.accessToken}`,
          "Content-Type": "application/json",
        },
        body: JSON.stringify(body),
        signal: controller.signal,
      });

      const data = await res.json().catch(() => undefined);

      if (res.ok && data?.messages?.[0]?.id) {
        const messageId = data.messages[0].id;
        const status = data.messages[0]?.message_status;
        // Meta accepting the request only means "queued" — actual delivery
        // is reported asynchronously via webhook, which this integration
        // doesn't yet consume. Logging the message ID lets a failed delivery
        // be looked up in WhatsApp Manager's Activity log after the fact.
        logger.info("[WhatsApp] Send accepted", { messageId, status });
        return { success: true, messageId };
      }

      // Diagnostic fields only — status code and Meta's own numeric
      // error/subcode/type/fbtrace_id. Never the token, never the OTP, never
      // the full response body (which can echo request fields back).
      logger.error("[WhatsApp] Send failed", {
        status: res.status,
        code: data?.error?.code,
        subcode: data?.error?.error_subcode,
        type: data?.error?.type,
        fbtrace_id: data?.error?.fbtrace_id,
      });

      return { success: false, error: classifyMetaError(res.status, data) };
    } catch (err) {
      const aborted = err instanceof Error && err.name === "AbortError";
      logger.error("[WhatsApp] Request failed", {
        reason: aborted ? "timeout" : err instanceof Error ? err.message : "unknown",
      });
      return { success: false, error: aborted ? "WhatsApp API request timed out" : "WhatsApp API request failed" };
    } finally {
      clearTimeout(timeout);
    }
  }

  async sendSMS(_mobile: string, _message: string): Promise<{ success: boolean; messageId?: string; error?: string }> {
    // Authentication templates are the only supported send path on this
    // channel — a free-form WhatsApp message requires the recipient to have
    // messaged the business within the last 24h, which never holds for a
    // fresh signup/verification flow.
    return { success: false, error: "WhatsApp provider only supports template-based OTP delivery" };
  }
}
