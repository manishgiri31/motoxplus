import { baseTemplate } from "./base";

// Customer signup email check. Code only, no link: the code is typed into the
// signup screen next to the WhatsApp code, and the account is created only
// when both are correct (see /api/auth/customer/register).
// The name is whatever was typed into a public signup form, so it is escaped
// before it goes into the HTML.
function escapeHtml(s: string) {
  return s.replace(/[&<>"']/g, (c) => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;" })[c]!);
}

export function customerVerifyEmailTemplate(name: string, otp: string) {
  const content = `
    <div class="title">Confirm your email</div>
    <p class="text">Hi ${escapeHtml(name) || "there"},</p>
    <p class="text">Enter this code on the MOTOXPLUS sign-up screen to confirm your email address. We'll use it for order confirmations and invoices.</p>
    <div class="otp-box">
      <div class="otp">${otp}</div>
      <div class="otp-label">Valid for 5 minutes</div>
    </div>
    <hr class="divider" />
    <div class="warning">
      <p class="warning-text">If you didn't start creating a MOTOXPLUS account, ignore this email. No account is created without this code.</p>
    </div>
  `;
  return baseTemplate("Confirm your email — MOTOXPLUS", content);
}
