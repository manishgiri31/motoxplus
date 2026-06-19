import { baseTemplate } from "./base";

export function invoiceGeneratedTemplate(name: string, invoiceNumber: string, orderNumber: string, grandTotal: number, pdfUrl?: string) {
  const content = `
    <div class="title">Invoice Generated</div>
    <p class="text">Hi ${name},</p>
    <p class="text">Invoice <strong style="color:#fff;">#${invoiceNumber}</strong> for order <strong style="color:#fff;">#${orderNumber}</strong> has been generated.</p>
    <div style="background:#1a1a1a;border:1px solid #1f1f1f;border-radius:2px;padding:20px;margin:20px 0;">
      <div style="display:flex;justify-content:space-between;margin-bottom:8px;">
        <span style="color:#6b7280;font-size:13px;">Invoice Number</span>
        <span style="color:#fff;font-size:13px;font-weight:700;">${invoiceNumber}</span>
      </div>
      <div style="display:flex;justify-content:space-between;margin-bottom:8px;">
        <span style="color:#6b7280;font-size:13px;">Order Number</span>
        <span style="color:#9ca3af;font-size:13px;">${orderNumber}</span>
      </div>
      <div style="display:flex;justify-content:space-between;">
        <span style="color:#6b7280;font-size:13px;">Grand Total</span>
        <span style="color:#DC2626;font-size:16px;font-weight:900;">₹${grandTotal.toFixed(2)}</span>
      </div>
    </div>
    ${pdfUrl ? `<div style="text-align:center;"><a href="${pdfUrl}" class="btn">Download Invoice PDF</a></div>` : ""}
    <p class="small">You can also download the invoice from your dealer portal under Orders → Invoices.</p>
  `;
  return baseTemplate(`Invoice #${invoiceNumber} — MOTOXPLUS`, content);
}
