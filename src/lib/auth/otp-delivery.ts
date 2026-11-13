import type { OtpType } from "@prisma/client";
import { sendOTP as sendWhatsAppOtp } from "@/lib/sms";
import { sendEmail, loginOtpTemplate, customerVerifyEmailTemplate } from "@/lib/email";

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
  // Customer signup (/api/auth/customer/register). Dealer email verification
  // still uses its own route + link template.
  EMAIL_VERIFICATION: "Confirm your email — MOTOXPLUS",
};

export async function deliverOtp(opts: DeliverOtpOptions): Promise<DeliverOtpResult> {
  if (opts.channel === "WHATSAPP") {
    const result = await sendWhatsAppOtp(opts.destination, opts.code);
    return result.success ? { delivered: true } : { delivered: false, error: "Failed to send OTP. Try again." };
  }

  const subject = EMAIL_SUBJECTS[opts.purpose] ?? "Your OTP — MOTOXPLUS";
  try {
    const html =
      opts.purpose === "EMAIL_VERIFICATION"
        ? customerVerifyEmailTemplate(opts.name || "", opts.code)
        : loginOtpTemplate(opts.name || "", opts.code);
    const sent = await sendEmail({ to: opts.destination, subject, html });
    // Same dev-only escape hatch as the SMS dev-skip (src/lib/sms/index.ts):
    // with no Resend credentials locally, print the code so signup is testable.
    if (sent?.skipped &&process.env.NODE_ENV !== "production") {
      console.warn(`[Email] not configured — ${opts.purpose} code for ${opts.destination}: ${opts.code}`);
    }
    return { delivered: true };
  } catch {
    return { delivered: false, error: "Failed to send OTP. Try again." };
  }
}
