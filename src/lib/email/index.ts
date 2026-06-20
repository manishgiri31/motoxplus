import { Resend } from "resend";

const FROM_EMAIL = process.env.EMAIL_FROM || "noreply@motoxplus.in";
const FROM_NAME = "MOTOXPLUS India";

interface SendEmailOptions {
  to: string;
  subject: string;
  html: string;
  idempotencyKey?: string;
}

export async function sendEmail(opts: SendEmailOptions) {
  if (!process.env.RESEND_API_KEY) {
    console.warn("[Email] RESEND_API_KEY not set — skipping email send to", opts.to);
    return { id: "skipped" };
  }

  const resend = new Resend(process.env.RESEND_API_KEY);
  const { data, error } = await resend.emails.send({
    from: `${FROM_NAME} <${FROM_EMAIL}>`,
    to: opts.to,
    subject: opts.subject,
    html: opts.html,
    ...(opts.idempotencyKey ? { idempotencyKey: opts.idempotencyKey } : {}),
  });

  if (error) {
    console.error("[Email] Send failed:", error);
    throw new Error(error.message);
  }

  return data;
}

export { verifyEmailTemplate } from "./templates/verify-email";
export { welcomeTemplate } from "./templates/welcome";
export { passwordResetTemplate } from "./templates/password-reset";
export { dealerApprovedTemplate } from "./templates/dealer-approved";
export { orderConfirmationTemplate } from "./templates/order-confirmation";
export { invoiceGeneratedTemplate } from "./templates/invoice-generated";
export { shipmentDispatchedTemplate } from "./templates/shipment-dispatched";
