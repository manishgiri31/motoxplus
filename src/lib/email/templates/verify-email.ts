import { baseTemplate } from "./base";

export function verifyEmailTemplate(name: string, verificationUrl: string, otp?: string) {
  const content = `
    <div class="title">Verify Your Email Address</div>
    <p class="text">Hi ${name || "there"},</p>
    <p class="text">Welcome to MOTOXPLUS India. Please verify your email address to activate your dealer account.</p>
    ${otp ? `
    <div class="otp-box">
      <div class="otp">${otp}</div>
      <div class="otp-label">Email Verification OTP — Valid for 10 minutes</div>
    </div>
    ` : ""}
    <p class="text" style="text-align:center;">Or click the button below to verify:</p>
    <div style="text-align:center;">
      <a href="${verificationUrl}" class="btn">Verify Email Address</a>
    </div>
    <hr class="divider" />
    <div class="warning">
      <p class="warning-text">This link expires in 24 hours and can only be used once. If you did not create an account, please ignore this email.</p>
    </div>
    <p class="small">If the button doesn't work, copy and paste this link into your browser:<br/><span style="color:#9ca3af;">${verificationUrl}</span></p>
  `;
  return baseTemplate("Verify Your Email — MOTOXPLUS", content);
}
