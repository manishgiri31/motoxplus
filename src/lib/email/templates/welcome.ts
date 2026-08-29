import { baseTemplate } from "./base";

export function welcomeTemplate(name: string, email: string, accountType: "dealer" | "vendor" = "dealer") {
  const intro =
    accountType === "vendor"
      ? `Your vendor account has been created successfully. Our team will review your application and approve it within 2-3 business days.`
      : `Your dealer account has been created successfully. There's no approval wait — just verify your details and you're ready to go.`;

  const steps =
    accountType === "vendor"
      ? `
      <li>Verify your email and mobile number to activate your account</li>
      <li>Our team reviews your application and documents</li>
      <li>You'll receive an approval email once your vendor account is active</li>
      <li>Once approved, you can access the vendor portal</li>`
      : `
      <li>Verify your email address</li>
      <li>Verify your mobile number</li>
      <li>Sign in to the dealer portal — browse the catalog with dealer pricing and place orders</li>`;

  const content = `
    <div class="title">Welcome to MOTOXPLUS</div>
    <p class="text">Hi ${name || "there"},</p>
    <p class="text">${intro}</p>
    <p class="text">Here's what happens next:</p>
    <ul style="color:#9ca3af;font-size:14px;line-height:2;padding-left:20px;margin-bottom:16px;">${steps}
    </ul>
    <hr class="divider" />
    <p class="small">Account Email: <span style="color:#e5e5e5;">${email}</span></p>
    <p class="small">If you have questions, contact us at support@motoxplus.in or WhatsApp: +91 92171 31801</p>
  `;
  return baseTemplate("Welcome to MOTOXPLUS India", content);
}
