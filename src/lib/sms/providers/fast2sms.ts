import type { SMSProvider } from "../types";

export class Fast2SMSProvider implements SMSProvider {
  name = "Fast2SMS";
  private apiKey = process.env.FAST2SMS_API_KEY || "";

  async sendOTP(mobile: string, otp: string): Promise<{ success: boolean; messageId?: string; error?: string }> {
    if (!this.apiKey) return { success: false, error: "FAST2SMS_API_KEY not configured" };

    const url = "https://www.fast2sms.com/dev/bulkV2";
    const res = await fetch(url, {
      method: "POST",
      headers: { authorization: this.apiKey, "Content-Type": "application/json" },
      body: JSON.stringify({
        route: "otp",
        variables_values: otp,
        numbers: mobile.replace("+91", "").replace(/\s/g, ""),
      }),
    });
    const data = await res.json();

    if (data.return) return { success: true, messageId: data.request_id };
    return { success: false, error: data.message?.[0] || "Fast2SMS OTP send failed" };
  }

  async sendSMS(mobile: string, message: string): Promise<{ success: boolean; messageId?: string; error?: string }> {
    if (!this.apiKey) return { success: false, error: "FAST2SMS_API_KEY not configured" };

    const res = await fetch("https://www.fast2sms.com/dev/bulkV2", {
      method: "POST",
      headers: { authorization: this.apiKey, "Content-Type": "application/json" },
      body: JSON.stringify({
        route: "q",
        message,
        numbers: mobile.replace("+91", "").replace(/\s/g, ""),
      }),
    });
    const data = await res.json();

    if (data.return) return { success: true, messageId: data.request_id };
    return { success: false, error: data.message?.[0] || "Fast2SMS send failed" };
  }
}
