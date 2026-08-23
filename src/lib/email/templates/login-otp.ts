import { baseTemplate } from "./base";

export function loginOtpTemplate(name: string, otp: string) {
  const content = `
    <div class="title">Your Login OTP</div>
    <p class="text">Hi ${name || "there"},</p>
    <p class="text">Use the OTP below to sign in to your MOTOXPLUS dealer account:</p>
    <div class="otp-box">
      <div class="otp">${otp}</div>
      <div class="otp-label">Login OTP — Valid for 10 minutes</div>
    </div>
    <hr class="divider" />
    <div class="warning">
      <p class="warning-text">If you didn't request this, you can safely ignore this email — no one can sign in without this code.</p>
    </div>
    <p class="small">For security, this OTP is valid for 10 minutes and can only be used once.</p>
  `;
  return baseTemplate("Login OTP — MOTOXPLUS", content);
}
