import { baseTemplate } from "./base";

export function welcomeTemplate(name: string, email: string) {
  const content = `
    <div class="title">Welcome to MOTOXPLUS</div>
    <p class="text">Hi ${name || "there"},</p>
    <p class="text">Your dealer account has been created successfully. Our team will review your application and approve it within 2-3 business days.</p>
    <p class="text">Here's what happens next:</p>
    <ul style="color:#9ca3af;font-size:14px;line-height:2;padding-left:20px;margin-bottom:16px;">
      <li>Our team reviews your application and documents</li>
      <li>You'll receive an approval email with your dealer credentials</li>
      <li>Once approved, you can access the dealer portal and start placing orders</li>
    </ul>
    <hr class="divider" />
    <p class="small">Account Email: <span style="color:#e5e5e5;">${email}</span></p>
    <p class="small">If you have questions, contact us at support@motoxplus.in or WhatsApp: +91 92171 31801</p>
  `;
  return baseTemplate("Welcome to MOTOXPLUS India", content);
}
