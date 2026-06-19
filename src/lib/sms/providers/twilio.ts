import type { SMSProvider } from "../types";

export class TwilioProvider implements SMSProvider {
  name = "Twilio";

  private accountSid = process.env.TWILIO_ACCOUNT_SID || "";
  private authToken = process.env.TWILIO_AUTH_TOKEN || "";
  private from = process.env.TWILIO_FROM_NUMBER || "";

  async sendOTP(mobile: string, otp: string): Promise<{ success: boolean; messageId?: string; error?: string }> {
    return this.sendSMS(mobile, `Your MOTOXPLUS OTP is: ${otp}. Valid for 10 minutes. Do not share.`);
  }

  async sendSMS(mobile: string, message: string): Promise<{ success: boolean; messageId?: string; error?: string }> {
    if (!this.accountSid || !this.authToken) return { success: false, error: "Twilio credentials not configured" };

    const url = `https://api.twilio.com/2010-04-01/Accounts/${this.accountSid}/Messages.json`;
    const credentials = Buffer.from(`${this.accountSid}:${this.authToken}`).toString("base64");

    const body = new URLSearchParams({ To: mobile, From: this.from, Body: message });
    const res = await fetch(url, {
      method: "POST",
      headers: { Authorization: `Basic ${credentials}`, "Content-Type": "application/x-www-form-urlencoded" },
      body,
    });
    const data = await res.json();

    if (res.ok) return { success: true, messageId: data.sid };
    return { success: false, error: data.message || "Twilio send failed" };
  }
}
