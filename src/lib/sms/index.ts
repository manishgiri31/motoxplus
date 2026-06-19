import type { SMSProvider } from "./types";
import { MSG91Provider } from "./providers/msg91";
import { TwilioProvider } from "./providers/twilio";
import { Fast2SMSProvider } from "./providers/fast2sms";

function getProvider(): SMSProvider {
  const provider = process.env.SMS_PROVIDER || "msg91";
  switch (provider.toLowerCase()) {
    case "twilio": return new TwilioProvider();
    case "fast2sms": return new Fast2SMSProvider();
    default: return new MSG91Provider();
  }
}

export async function sendOTP(mobile: string, otp: string, templateId?: string) {
  const provider = getProvider();
  const normalizedMobile = mobile.startsWith("+91") ? mobile : `+91${mobile.replace(/\s/g, "")}`;

  if (!process.env.SMS_PROVIDER && !process.env.MSG91_AUTH_KEY) {
    console.warn(`[SMS] No SMS provider configured — OTP for ${normalizedMobile}: ${otp}`);
    return { success: true, messageId: "dev-skip" };
  }

  return provider.sendOTP(normalizedMobile, otp, templateId);
}

export async function sendSMS(mobile: string, message: string) {
  const provider = getProvider();
  const normalizedMobile = mobile.startsWith("+91") ? mobile : `+91${mobile.replace(/\s/g, "")}`;
  return provider.sendSMS(normalizedMobile, message);
}
