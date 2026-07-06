import { baseTemplate } from "./base";

export function vendorApprovedTemplate(name: string, companyName: string, loginUrl: string) {
  const content = `
    <div class="title">Your Vendor Account is Approved!</div>
    <p class="text">Congratulations, ${name}!</p>
    <p class="text">Your vendor account for <strong style="color:#fff;">${companyName}</strong> has been approved. You can now access the MOTOXPLUS vendor portal to manage purchase orders, submit invoices, and track payments.</p>
    <div style="text-align:center;">
      <a href="${loginUrl}" class="btn">Access Vendor Portal</a>
    </div>
    <hr class="divider" />
    <p class="text">What you can do now:</p>
    <ul style="color:#9ca3af;font-size:14px;line-height:2;padding-left:20px;margin-bottom:16px;">
      <li>View and accept purchase orders</li>
      <li>Track payments and credit terms</li>
      <li>Update your product/service catalog</li>
    </ul>
    <p class="small">For assistance, contact your account manager at procurement@motoxplus.in</p>
  `;
  return baseTemplate("Account Approved — MOTOXPLUS Vendor Portal", content);
}
