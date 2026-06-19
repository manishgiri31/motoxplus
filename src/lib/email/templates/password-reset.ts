import { baseTemplate } from "./base";

export function passwordResetTemplate(name: string, otp: string) {
  const content = `
    <div class="title">Reset Your Password</div>
    <p class="text">Hi ${name || "there"},</p>
    <p class="text">We received a request to reset your MOTOXPLUS dealer account password. Use the OTP below:</p>
    <div class="otp-box">
      <div class="otp">${otp}</div>
      <div class="otp-label">Password Reset OTP — Valid for 10 minutes</div>
    </div>
    <hr class="divider" />
    <div class="warning">
      <p class="warning-text">If you didn't request a password reset, please ignore this email and ensure your account is secure. Your password will not change until you complete the reset process.</p>
    </div>
    <p class="small">For security, this OTP is valid for 10 minutes and can only be used once.</p>
  `;
  return baseTemplate("Password Reset OTP — MOTOXPLUS", content);
}
