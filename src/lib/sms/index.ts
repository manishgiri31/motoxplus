import type { SMSProvider } from "./types";
import { MSG91Provider } from "./providers/msg91";
import { TwilioProvider } from "./providers/twilio";
import { Fast2SMSProvider } from "./providers/fast2sms";
import { logger } from "@/lib/logger";

function getProvider(): SMSProvider {
  const provider = process.env.SMS_PROVIDER || "msg91";
  switch (provider.toLowerCase()) {
    case "twilio": return new TwilioProvider();
    case "fast2sms": return new Fast2SMSProvider();
    default: return new MSG91Provider();
  }
}

function isPlaceholder(value: string | undefined): boolean {
  return !value || value.startsWith("your_") || value.includes("_here");
}

export async function sendOTP(mobile: string, otp: string, templateId?: string) {
  const provider = getProvider();
  const normalizedMobile = mobile.startsWith("+91") ? mobile : `+91${mobile.replace(/\s/g, "")}`;

  // These dev-skip fallbacks intentionally print the OTP straight to stdout
  // (not through `logger`, which emits structured JSON in production and
  // would land in PM2's log files) — they only fire outside production, so
  // a developer without SMS credentials configured can still see the code.
  // In production a missing/placeholder credential must never be logged
  // alongside the live code it's supposed to protect.
  if (!process.env.MSG91_AUTH_KEY) {
    if (process.env.NODE_ENV === "production") {
      logger.error("[SMS] No SMS provider configured — OTP send skipped", { mobile: normalizedMobile });
    } else {
      console.warn(`[SMS] No SMS provider configured — OTP for ${normalizedMobile}: ${otp}`);
    }
    return { success: true, messageId: "dev-skip" };
  }

  // MSG91 is configured with a real auth key but a still-placeholder
  // OTP template ID — sends would fail against the live API, so fall back
  // to logging the code until a real template ID is provisioned.
  if ((process.env.SMS_PROVIDER || "msg91").toLowerCase() === "msg91" && isPlaceholder(templateId || process.env.MSG91_OTP_TEMPLATE_ID)) {
    if (process.env.NODE_ENV === "production") {
      logger.error("[SMS] MSG91_OTP_TEMPLATE_ID is a placeholder — OTP send skipped", { mobile: normalizedMobile });
    } else {
      console.warn(`[SMS] MSG91_OTP_TEMPLATE_ID is a placeholder — OTP for ${normalizedMobile}: ${otp}`);
    }
    return { success: true, messageId: "dev-skip" };
  }

  return provider.sendOTP(normalizedMobile, otp, templateId);
}

export async function sendSMS(mobile: string, message: string) {
  const provider = getProvider();
  const normalizedMobile = mobile.startsWith("+91") ? mobile : `+91${mobile.replace(/\s/g, "")}`;
  return provider.sendSMS(normalizedMobile, message);
}
