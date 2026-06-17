"use client";

import { useRef } from "react";
import { formatCurrency, formatDate } from "@/lib/utils";
import { Download, Printer } from "lucide-react";

interface InvoiceData {
  id: string;
  invoiceNumber: string;
  issuedAt: string;
  subtotal: number;
  gstAmount: number;
  grandTotal: number;
  dealer: {
    companyName: string;
    gstNumber: string;
    ownerName: string;
    phone: string;
    address: string;
    city: string;
    state: string;
    pincode: string;
    user: { email: string };
  };
  order: {
    orderNumber: string;
    paymentType: string;
    amountPaid: number;
    amountDue: number;
    items: Array<{
      quantity: number;
      unitPrice: number;
      gstRate: number;
      gstAmount: number;
      total: number;
      product: { name: string; partNumber: string; sku: string; hsnCode?: string; countryOfOrigin?: string; packageWeight?: number | null; brand?: string };
    }>;
  };
}

export function InvoiceView({ invoice }: { invoice: InvoiceData }) {
  const printRef = useRef<HTMLDivElement>(null);

  const handlePrint = () => {
    window.print();
  };

  const handleDownload = async () => {
    const { jsPDF } = await import("jspdf");
    const autoTable = (await import("jspdf-autotable")).default;

    const doc = new jsPDF();

    // Header
    doc.setFillColor(220, 38, 38);
    doc.rect(0, 0, 210, 30, "F");
    doc.setTextColor(255, 255, 255);
    doc.setFontSize(20);
    doc.setFont("helvetica", "bold");
    doc.text("MOTOXPLUS INDIA PVT. LTD.", 15, 15);
    doc.setFontSize(9);
    doc.setFont("helvetica", "normal");
    doc.text(process.env.NEXT_PUBLIC_COMPANY_ADDRESS || "India", 15, 22);

    // Invoice title
    doc.setTextColor(0, 0, 0);
    doc.setFontSize(16);
    doc.setFont("helvetica", "bold");
    doc.text("TAX INVOICE", 140, 45);
    doc.setFontSize(10);
    doc.setFont("helvetica", "normal");
    doc.text(`Invoice #: ${invoice.invoiceNumber}`, 140, 52);
    doc.text(`Date: ${formatDate(invoice.issuedAt)}`, 140, 58);
    doc.text(`Order #: ${invoice.order.orderNumber}`, 140, 64);

    // Company details
    doc.setFontSize(10);
    doc.setFont("helvetica", "bold");
    doc.text("From:", 15, 42);
    doc.setFont("helvetica", "normal");
    doc.text("MotoXPlus India Pvt. Ltd.", 15, 49);
    doc.text(process.env.NEXT_PUBLIC_COMPANY_ADDRESS || "", 15, 55);
    doc.text(`GST: ${process.env.NEXT_PUBLIC_COMPANY_GST || ""}`, 15, 61);
    doc.text(`Phone: ${process.env.NEXT_PUBLIC_COMPANY_PHONE || ""}`, 15, 67);

    // Bill to
    doc.setFont("helvetica", "bold");
    doc.text("Bill To:", 15, 80);
    doc.setFont("helvetica", "normal");
    doc.text(invoice.dealer.companyName, 15, 87);
    doc.text(invoice.dealer.ownerName, 15, 93);
    doc.text(`${invoice.dealer.address}, ${invoice.dealer.city}`, 15, 99);
    doc.text(`${invoice.dealer.state} - ${invoice.dealer.pincode}`, 15, 105);
    doc.text(`GST: ${invoice.dealer.gstNumber}`, 15, 111);
    doc.text(`Phone: ${invoice.dealer.phone}`, 15, 117);

    // Items table
    autoTable(doc, {
      startY: 128,
      head: [["#", "Part No.", "HSN", "Product", "Qty", "Unit Price", "GST", "Total"]],
      body: invoice.order.items.map((item, i) => [
        i + 1,
        item.product.partNumber,
        item.product.hsnCode || "",
        item.product.name,
        item.quantity,
        formatCurrency(item.unitPrice),
        `${item.gstRate}%`,
        formatCurrency(item.total),
      ]),
      styles: { fontSize: 9, cellPadding: 3 },
      headStyles: { fillColor: [220, 38, 38], textColor: [255, 255, 255], fontStyle: "bold" },
      alternateRowStyles: { fillColor: [250, 250, 250] },
    });

    const finalY = (doc as any).lastAutoTable.finalY + 10;

    // Totals
    doc.setFontSize(10);
    doc.text(`Subtotal (excl. GST):`, 130, finalY + 8);
    doc.text(formatCurrency(invoice.subtotal), 185, finalY + 8, { align: "right" });
    doc.text(`GST Amount:`, 130, finalY + 15);
    doc.text(formatCurrency(invoice.gstAmount), 185, finalY + 15, { align: "right" });

    doc.setFillColor(220, 38, 38);
    doc.rect(125, finalY + 18, 75, 10, "F");
    doc.setTextColor(255, 255, 255);
    doc.setFont("helvetica", "bold");
    doc.text("Grand Total:", 130, finalY + 25);
    doc.text(formatCurrency(invoice.grandTotal), 185, finalY + 25, { align: "right" });

    doc.setTextColor(0, 0, 0);
    doc.setFont("helvetica", "normal");
    doc.setFontSize(9);
    doc.text(`Amount Paid: ${formatCurrency(invoice.order.amountPaid)}`, 15, finalY + 30);
    if (invoice.order.amountDue > 0) {
      doc.text(`Balance Due: ${formatCurrency(invoice.order.amountDue)}`, 15, finalY + 37);
    }

    // Footer
    doc.setFontSize(8);
    doc.setTextColor(150, 150, 150);
    doc.text("This is a computer-generated invoice and does not require a signature.", 15, 285);
    doc.text("Thank you for your business!", 15, 290);

    doc.save(`${invoice.invoiceNumber}.pdf`);
  };

  return (
    <div>
      {/* Action buttons */}
      <div className="flex items-center justify-between mb-8 print:hidden">
        <div>
          <h1 className="text-3xl font-black text-[var(--text-primary)] tracking-tight font-mono">
            {invoice.invoiceNumber}
          </h1>
          <p className="text-[var(--text-muted)] mt-1">Issued on {formatDate(invoice.issuedAt)}</p>
        </div>
        <div className="flex gap-3">
          <button
            onClick={handlePrint}
            className="flex items-center gap-2 glass border border-[var(--border-color)] hover:border-red-900/40 text-[var(--text-secondary)] font-bold px-4 py-2.5 rounded-sm transition-colors text-sm"
          >
            <Printer size={16} />
            Print
          </button>
          <button
            onClick={handleDownload}
            className="flex items-center gap-2 bg-red-600 hover:bg-red-700 text-white font-bold px-4 py-2.5 rounded-sm transition-colors text-sm"
          >
            <Download size={16} />
            Download PDF
          </button>
        </div>
      </div>

      {/* Invoice document */}
      <div ref={printRef} className="glass border border-[var(--border-color)] rounded-sm overflow-hidden print:border-0 print:rounded-none">
        {/* Header */}
        <div className="bg-red-600 px-8 py-6 flex justify-between items-start">
          <div>
            <div className="text-[var(--text-primary)] font-black text-2xl tracking-wide">
              MOTOX<span className="text-red-200">PLUS</span>
            </div>
            <div className="text-red-200 text-xs mt-1">India Pvt. Ltd.</div>
            <div className="text-red-100 text-xs mt-3 max-w-xs">
              {process.env.NEXT_PUBLIC_COMPANY_ADDRESS}
            </div>
            <div className="text-red-100 text-xs">GST: {process.env.NEXT_PUBLIC_COMPANY_GST}</div>
          </div>
          <div className="text-right">
            <div className="text-[var(--text-primary)]/60 text-xs uppercase tracking-widest mb-1">Tax Invoice</div>
            <div className="text-[var(--text-primary)] font-black text-xl font-mono">{invoice.invoiceNumber}</div>
            <div className="text-red-200 text-xs mt-2">Date: {formatDate(invoice.issuedAt)}</div>
            <div className="text-red-200 text-xs">Order: {invoice.order.orderNumber}</div>
          </div>
        </div>

        <div className="p-8">
          {/* Addresses */}
          <div className="grid grid-cols-2 gap-8 mb-8 pb-8 border-b border-[var(--border-color)]">
            <div>
              <div className="text-[var(--text-muted)] text-xs uppercase tracking-widest mb-3">From</div>
              <div className="text-[var(--text-primary)] font-bold">MotoXPlus India Pvt. Ltd.</div>
              <div className="text-[var(--text-muted)] text-sm mt-1">{process.env.NEXT_PUBLIC_COMPANY_ADDRESS}</div>
              <div className="text-[var(--text-muted)] text-sm">Phone: {process.env.NEXT_PUBLIC_COMPANY_PHONE}</div>
              <div className="text-[var(--text-muted)] text-sm">GST: {process.env.NEXT_PUBLIC_COMPANY_GST}</div>
            </div>
            <div>
              <div className="text-[var(--text-muted)] text-xs uppercase tracking-widest mb-3">Bill To</div>
              <div className="text-[var(--text-primary)] font-bold">{invoice.dealer.companyName}</div>
              <div className="text-[var(--text-muted)] text-sm">{invoice.dealer.ownerName}</div>
              <div className="text-[var(--text-muted)] text-sm">{invoice.dealer.address}, {invoice.dealer.city}</div>
              <div className="text-[var(--text-muted)] text-sm">{invoice.dealer.state} - {invoice.dealer.pincode}</div>
              <div className="text-[var(--text-muted)] text-sm">GST: {invoice.dealer.gstNumber}</div>
              <div className="text-[var(--text-muted)] text-sm">Phone: {invoice.dealer.phone}</div>
            </div>
          </div>

          {/* Items */}
          <table className="w-full mb-8">
            <thead>
              <tr className="border-b border-[var(--border-color)]">
                <th className="pb-3 text-left text-xs text-[var(--text-muted)] uppercase tracking-widest">#</th>
                <th className="pb-3 text-left text-xs text-[var(--text-muted)] uppercase tracking-widest">Part No.</th>
                <th className="pb-3 text-left text-xs text-[var(--text-muted)] uppercase tracking-widest">HSN</th>
                <th className="pb-3 text-left text-xs text-[var(--text-muted)] uppercase tracking-widest">Product</th>
                <th className="pb-3 text-right text-xs text-[var(--text-muted)] uppercase tracking-widest">Qty</th>
                <th className="pb-3 text-right text-xs text-[var(--text-muted)] uppercase tracking-widest">Unit Price</th>
                <th className="pb-3 text-right text-xs text-[var(--text-muted)] uppercase tracking-widest">GST</th>
                <th className="pb-3 text-right text-xs text-[var(--text-muted)] uppercase tracking-widest">Total</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-[var(--border-color)]">
              {invoice.order.items.map((item, i) => (
                <tr key={i}>
                  <td className="py-3 text-[var(--text-muted)] text-sm">{i + 1}</td>
                  <td className="py-3 text-[var(--text-muted)] text-sm font-mono">{item.product.partNumber}</td>
                  <td className="py-3 text-[var(--text-muted)] text-sm font-mono">{item.product.hsnCode || "—"}</td>
                  <td className="py-3 text-[var(--text-primary)] text-sm">
                    {item.product.name}
                    {item.product.countryOfOrigin && (
                      <div className="text-[var(--text-muted)] text-[10px]">Origin: {item.product.countryOfOrigin}</div>
                    )}
                  </td>
                  <td className="py-3 text-right text-[var(--text-secondary)] text-sm">{item.quantity}</td>
                  <td className="py-3 text-right text-[var(--text-secondary)] text-sm">{formatCurrency(item.unitPrice)}</td>
                  <td className="py-3 text-right text-[var(--text-secondary)] text-sm">{item.gstRate}%</td>
                  <td className="py-3 text-right text-[var(--text-primary)] font-bold text-sm">{formatCurrency(item.total)}</td>
                </tr>
              ))}
            </tbody>
          </table>

          {/* Totals */}
          <div className="flex justify-end">
            <div className="w-64 space-y-2">
              <div className="flex justify-between text-sm">
                <span className="text-[var(--text-muted)]">Subtotal (excl. GST)</span>
                <span className="text-[var(--text-primary)]">{formatCurrency(invoice.subtotal)}</span>
              </div>
              <div className="flex justify-between text-sm">
                <span className="text-[var(--text-muted)]">GST Amount</span>
                <span className="text-[var(--text-primary)]">{formatCurrency(invoice.gstAmount)}</span>
              </div>
              <div className="flex justify-between bg-red-600 px-4 py-2 rounded-sm font-bold">
                <span className="text-[var(--text-primary)]">Grand Total</span>
                <span className="text-[var(--text-primary)]">{formatCurrency(invoice.grandTotal)}</span>
              </div>
              <div className="flex justify-between text-sm pt-2">
                <span className="text-[var(--text-muted)]">Amount Paid</span>
                <span className="text-green-400 font-semibold">{formatCurrency(invoice.order.amountPaid)}</span>
              </div>
              {invoice.order.amountDue > 0 && (
                <div className="flex justify-between text-sm">
                  <span className="text-[var(--text-muted)]">Balance Due</span>
                  <span className="text-yellow-400 font-semibold">{formatCurrency(invoice.order.amountDue)}</span>
                </div>
              )}
            </div>
          </div>

          {/* Footer */}
          <div className="mt-12 pt-6 border-t border-[var(--border-color)] text-center text-gray-600 text-xs">
            <p>This is a computer-generated invoice. No signature required.</p>
            <p className="mt-1">Thank you for your business!</p>
          </div>
        </div>
      </div>
    </div>
  );
}
