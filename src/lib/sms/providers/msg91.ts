import type { SMSProvider } from "../types";

export class MSG91Provider implements SMSProvider {
  name = "MSG91";

  private authKey = process.env.MSG91_AUTH_KEY || "";
  private senderId = process.env.MSG91_SENDER_ID || "MOTOXX";
  private otpTemplateId = process.env.MSG91_OTP_TEMPLATE_ID || "";

  async sendOTP(mobile: string, otp: string, templateId?: string): Promise<{ success: boolean; messageId?: string; error?: string }> {
    if (!this.authKey) return { success: false, error: "MSG91_AUTH_KEY not configured" };

    const tplId = templateId || this.otpTemplateId;
    const url = `https://control.msg91.com/api/v5/otp?authkey=${this.authKey}&template_id=${tplId}&mobile=${mobile}&otp=${otp}`;

    const res = await fetch(url, { method: "POST", headers: { "Content-Type": "application/json" } });
    const data = await res.json();

    if (data.type === "success") return { success: true, messageId: data.request_id };
    return { success: false, error: data.message || "MSG91 OTP send failed" };
  }

  async sendSMS(mobile: string, message: string): Promise<{ success: boolean; messageId?: string; error?: string }> {
    if (!this.authKey) return { success: false, error: "MSG91_AUTH_KEY not configured" };

    const body = JSON.stringify({
      flow_id: process.env.MSG91_FLOW_ID || "",
      sender: this.senderId,
      mobiles: mobile,
      message,
    });

    const res = await fetch("https://control.msg91.com/api/v5/flow/", {
      method: "POST",
      headers: { authkey: this.authKey, "Content-Type": "application/json" },
      body,
    });
    const data = await res.json();

    if (data.type === "success") return { success: true, messageId: data.request_id };
    return { success: false, error: data.message || "MSG91 SMS send failed" };
  }
}
