import { baseTemplate } from "./base";

export function orderConfirmationTemplate(
  name: string,
  orderNumber: string,
  grandTotal: number,
  items: { name: string; quantity: number; total: number }[]
) {
  const itemRows = items
    .map(
      (i) => `<tr>
      <td style="padding:10px 0;color:#9ca3af;font-size:13px;border-bottom:1px solid #1f1f1f;">${i.name}</td>
      <td style="padding:10px 0;color:#9ca3af;font-size:13px;text-align:center;border-bottom:1px solid #1f1f1f;">${i.quantity}</td>
      <td style="padding:10px 0;color:#e5e5e5;font-size:13px;text-align:right;border-bottom:1px solid #1f1f1f;">₹${i.total.toFixed(2)}</td>
    </tr>`
    )
    .join("");

  const content = `
    <div class="title">Order Confirmed</div>
    <p class="text">Hi ${name},</p>
    <p class="text">Your order <strong style="color:#fff;">#${orderNumber}</strong> has been confirmed. Here's a summary:</p>
    <table style="width:100%;border-collapse:collapse;margin:16px 0;">
      <thead>
        <tr>
          <th style="text-align:left;font-size:11px;color:#6b7280;letter-spacing:1px;text-transform:uppercase;padding-bottom:8px;border-bottom:1px solid #1f1f1f;">Product</th>
          <th style="text-align:center;font-size:11px;color:#6b7280;letter-spacing:1px;text-transform:uppercase;padding-bottom:8px;border-bottom:1px solid #1f1f1f;">Qty</th>
          <th style="text-align:right;font-size:11px;color:#6b7280;letter-spacing:1px;text-transform:uppercase;padding-bottom:8px;border-bottom:1px solid #1f1f1f;">Total</th>
        </tr>
      </thead>
      <tbody>${itemRows}</tbody>
      <tfoot>
        <tr>
          <td colspan="2" style="padding:12px 0;font-weight:700;color:#fff;font-size:14px;">Grand Total</td>
          <td style="padding:12px 0;font-weight:700;color:#DC2626;font-size:16px;text-align:right;">₹${grandTotal.toFixed(2)}</td>
        </tr>
      </tfoot>
    </table>
    <hr class="divider" />
    <p class="small">You'll receive a dispatch notification once your order ships. Track your order from the dealer portal.</p>
  `;
  return baseTemplate(`Order #${orderNumber} Confirmed — MOTOXPLUS`, content);
}
