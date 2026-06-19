import { baseTemplate } from "./base";

export function shipmentDispatchedTemplate(name: string, orderNumber: string, waybill: string, trackingUrl?: string) {
  const content = `
    <div class="title">Your Order Has Been Dispatched</div>
    <p class="text">Hi ${name},</p>
    <p class="text">Great news! Your order <strong style="color:#fff;">#${orderNumber}</strong> has been dispatched.</p>
    <div style="background:#1a1a1a;border:1px solid #1f1f1f;border-radius:2px;padding:20px;margin:20px 0;">
      <div style="margin-bottom:8px;">
        <span style="color:#6b7280;font-size:11px;letter-spacing:1px;text-transform:uppercase;">Tracking / AWB Number</span>
        <div style="color:#DC2626;font-size:20px;font-weight:900;letter-spacing:2px;margin-top:4px;">${waybill}</div>
      </div>
      <div style="margin-top:16px;">
        <span style="color:#6b7280;font-size:11px;letter-spacing:1px;text-transform:uppercase;">Courier Partner</span>
        <div style="color:#9ca3af;font-size:13px;margin-top:4px;">Delhivery</div>
      </div>
    </div>
    ${trackingUrl ? `<div style="text-align:center;"><a href="${trackingUrl}" class="btn">Track Your Shipment</a></div>` : ""}
    <hr class="divider" />
    <p class="small">You can also track your shipment from the dealer portal under Orders → Tracking. Estimated delivery is 3-7 business days.</p>
  `;
  return baseTemplate(`Order #${orderNumber} Dispatched — MOTOXPLUS`, content);
}
