import type { OtpType } from "@prisma/client";
import { sendOTP as sendWhatsAppOtp } from "@/lib/sms";
import { sendEmail, loginOtpTemplate } from "@/lib/email";

export type OtpChannel = "EMAIL" | "WHATSAPP";

interface DeliverOtpOptions {
  channel: OtpChannel;
  destination: string; // normalized email or bare 10-digit mobile
  code: string;
  purpose: OtpType;
  name?: string;
}

export type DeliverOtpResult = { delivered: true } | { delivered: false; error: string };

// Everything that requests an OTP calls this instead of branching on
// channel itself — the authentication layer picks EMAIL or WHATSAPP, this
// picks the provider and copy. Only LOGIN has an email template wired up
// today (the only purpose that currently routes through here); other
// purposes keep their existing dedicated routes/templates for now.
const EMAIL_SUBJECTS: Partial<Record<OtpType, string>> = {
  LOGIN: "Login OTP — MOTOXPLUS",
};

export async function deliverOtp(opts: DeliverOtpOptions): Promise<DeliverOtpResult> {
  if (opts.channel === "WHATSAPP") {
    const result = await sendWhatsAppOtp(opts.destination, opts.code);
    return result.success ? { delivered: true } : { delivered: false, error: "Failed to send OTP. Try again." };
  }

  const subject = EMAIL_SUBJECTS[opts.purpose] ?? "Your OTP — MOTOXPLUS";
  try {
    await sendEmail({ to: opts.destination, subject, html: loginOtpTemplate(opts.name || "", opts.code) });
    return { delivered: true };
  } catch {
    return { delivered: false, error: "Failed to send OTP. Try again." };
  }
}
