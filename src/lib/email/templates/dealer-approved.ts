import { baseTemplate } from "./base";

export function dealerApprovedTemplate(name: string, companyName: string, loginUrl: string) {
  const content = `
    <div class="title">Your Dealer Account is Approved!</div>
    <p class="text">Congratulations, ${name}!</p>
    <p class="text">Your dealer account for <strong style="color:#fff;">${companyName}</strong> has been approved. You can now access the MOTOXPLUS dealer portal to browse products, place orders, and manage your account.</p>
    <div style="text-align:center;">
      <a href="${loginUrl}" class="btn">Access Dealer Portal</a>
    </div>
    <hr class="divider" />
    <p class="text">What you can do now:</p>
    <ul style="color:#9ca3af;font-size:14px;line-height:2;padding-left:20px;margin-bottom:16px;">
      <li>Browse our full product catalog with dealer pricing</li>
      <li>Place orders with flexible payment options</li>
      <li>Track shipments in real time</li>
      <li>Download GST invoices</li>
    </ul>
    <p class="small">For assistance, contact your account manager at sales@motoxplus.in</p>
  `;
  return baseTemplate("Account Approved — MOTOXPLUS Dealer Portal", content);
}
