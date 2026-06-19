export interface SMSProvider {
  name: string;
  sendOTP(mobile: string, otp: string, templateId?: string): Promise<{ success: boolean; messageId?: string; error?: string }>;
  sendSMS(mobile: string, message: string): Promise<{ success: boolean; messageId?: string; error?: string }>;
}

export interface OTPSMSPayload {
  mobile: string;
  otp: string;
  purpose: "verification" | "login" | "reset";
}
