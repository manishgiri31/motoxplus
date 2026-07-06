import { Resend } from "resend";

const FROM_NAME = "MOTOXPLUS India";

interface SendEmailOptions {
  to: string;
  subject: string;
  html: string;
  idempotencyKey?: string;
}

interface SendEmailResult {
  id: string;
  skipped?: boolean;
}

export async function sendEmail(opts: SendEmailOptions): Promise<SendEmailResult> {
  const apiKey = process.env.RESEND_API_KEY;
  const fromEmail = process.env.EMAIL_FROM;

  const missing = [
    !apiKey && "RESEND_API_KEY",
    !fromEmail && "EMAIL_FROM",
  ].filter(Boolean).join(", ");

  if (missing) {
    console.warn(`[Email] ${missing} not set — skipping email send to ${opts.to}`);
    return { id: "skipped", skipped: true };
  }

  const resend = new Resend(apiKey);

  console.log(`[Email] Sending "${opts.subject}" to ${opts.to}...`);

  let data, error;
  try {
    ({ data, error } = await resend.emails.send({
      from: `${FROM_NAME} <${fromEmail}>`,
      to: opts.to,
      subject: opts.subject,
      html: opts.html,
      ...(opts.idempotencyKey ? { idempotencyKey: opts.idempotencyKey } : {}),
    }));
  } catch (err) {
    console.error(`[Email] Unexpected error sending to ${opts.to}:`, err);
    throw err instanceof Error ? err : new Error("Failed to send email");
  }

  if (error) {
    console.error(`[Email] Resend API error sending to ${opts.to}:`, error);
    throw new Error(error.message);
  }

  console.log(`[Email] Sent "${opts.subject}" to ${opts.to} — id: ${data?.id}`);
  return data as SendEmailResult;
}

export { verifyEmailTemplate } from "./templates/verify-email";
export { welcomeTemplate } from "./templates/welcome";
export { passwordResetTemplate } from "./templates/password-reset";
export { dealerApprovedTemplate } from "./templates/dealer-approved";
export { vendorApprovedTemplate } from "./templates/vendor-approved";
export { orderConfirmationTemplate } from "./templates/order-confirmation";
export { invoiceGeneratedTemplate } from "./templates/invoice-generated";
export { shipmentDispatchedTemplate } from "./templates/shipment-dispatched";
