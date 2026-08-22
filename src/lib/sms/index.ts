import type { SMSProvider } from "./types";
import { MSG91Provider } from "./providers/msg91";
import { TwilioProvider } from "./providers/twilio";
import { Fast2SMSProvider } from "./providers/fast2sms";
import { WhatsAppProvider } from "./providers/whatsapp";
import { logger } from "@/lib/logger";

function getProviderName(): string {
  return (process.env.SMS_PROVIDER || "msg91").toLowerCase();
}

function getProvider(name: string): SMSProvider {
  switch (name) {
    case "twilio": return new TwilioProvider();
    case "fast2sms": return new Fast2SMSProvider();
    case "whatsapp": return new WhatsAppProvider();
    default: return new MSG91Provider();
  }
}

function isPlaceholder(value: string | undefined): boolean {
  return !value || value.startsWith("your_") || value.includes("_here");
}

/**
 * Whether the selected provider's required credentials are present and
 * aren't still .env.example's placeholder values. Each provider needs a
 * different set of vars, so this can't be a single global check — it used
 * to hardcode a check against MSG91_AUTH_KEY regardless of which provider
 * was selected, which meant SMS_PROVIDER=twilio/fast2sms/whatsapp always
 * fell into the dev-skip branch below even with real credentials configured.
 */
function isProviderConfigured(name: string, templateId?: string): boolean {
  switch (name) {
    case "twilio":
      return !isPlaceholder(process.env.TWILIO_ACCOUNT_SID) && !isPlaceholder(process.env.TWILIO_AUTH_TOKEN);
    case "fast2sms":
      return !isPlaceholder(process.env.FAST2SMS_API_KEY);
    case "whatsapp":
      return !isPlaceholder(process.env.WHATSAPP_ACCESS_TOKEN) && !isPlaceholder(process.env.WHATSAPP_PHONE_NUMBER_ID);
    default:
      return !isPlaceholder(process.env.MSG91_AUTH_KEY) && !isPlaceholder(templateId || process.env.MSG91_OTP_TEMPLATE_ID);
  }
}

export async function sendOTP(mobile: string, otp: string, templateId?: string) {
  const providerName = getProviderName();
  const provider = getProvider(providerName);
  const normalizedMobile = mobile.startsWith("+91") ? mobile : `+91${mobile.replace(/\s/g, "")}`;

  // This dev-skip fallback intentionally prints the OTP straight to stdout
  // (not through `logger`, which emits structured JSON in production and
  // would land in PM2's log files) — it only fires outside production, so a
  // developer without provider credentials configured can still see the
  // code. In production a missing/placeholder credential must never be
  // logged alongside the live code it's supposed to protect.
  if (!isProviderConfigured(providerName, templateId)) {
    if (process.env.NODE_ENV === "production") {
      logger.error("[SMS] Selected provider is not configured — OTP send skipped", { mobile: normalizedMobile, provider: providerName });
    } else {
      console.warn(`[SMS] ${providerName} not configured — OTP for ${normalizedMobile}: ${otp}`);
    }
    return { success: true, messageId: "dev-skip" };
  }

  return provider.sendOTP(normalizedMobile, otp, templateId);
}

export async function sendSMS(mobile: string, message: string) {
  const provider = getProvider(getProviderName());
  const normalizedMobile = mobile.startsWith("+91") ? mobile : `+91${mobile.replace(/\s/g, "")}`;
  return provider.sendSMS(normalizedMobile, message);
}
