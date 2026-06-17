import { getServerSession } from "next-auth";
import { authOptions } from "@/lib/auth";
import { prisma } from "@/lib/prisma";
import { formatCurrency, formatDate } from "@/lib/utils";
import Link from "next/link";
import { FileText } from "lucide-react";

export default async function InvoicesPage() {
  const session = await getServerSession(authOptions);
  const dealer = await prisma.dealer.findUnique({ where: { userId: session!.user.id } });

  if (!dealer) return null;

  const invoices = await prisma.invoice.findMany({
    where: { dealerId: dealer.id },
    include: { order: true },
    orderBy: { createdAt: "desc" },
  });

  return (
    <div>
      <div className="mb-8">
        <h1 className="text-3xl font-black text-[var(--text-primary)] tracking-tight">Invoices</h1>
        <p className="text-[var(--text-muted)] mt-1">{invoices.length} total invoices</p>
      </div>

      {invoices.length === 0 ? (
        <div className="text-center py-20 glass border border-[var(--border-color)] rounded-sm">
          <FileText size={48} className="text-gray-700 mx-auto mb-4" />
          <h2 className="text-[var(--text-primary)] font-bold text-xl mb-2">No invoices yet</h2>
          <p className="text-[var(--text-muted)]">Invoices are generated after payment is confirmed.</p>
        </div>
      ) : (
        <div className="glass border border-[var(--border-color)] rounded-sm overflow-hidden">
          <table className="w-full">
            <thead>
              <tr className="border-b border-[var(--border-color)]">
                <th className="px-4 py-3 text-left text-xs text-[var(--text-muted)] uppercase tracking-widest">Invoice #</th>
                <th className="px-4 py-3 text-left text-xs text-[var(--text-muted)] uppercase tracking-widest">Order</th>
                <th className="px-4 py-3 text-left text-xs text-[var(--text-muted)] uppercase tracking-widest hidden md:table-cell">Date</th>
                <th className="px-4 py-3 text-left text-xs text-[var(--text-muted)] uppercase tracking-widest">Amount</th>
                <th className="px-4 py-3 text-left text-xs text-[var(--text-muted)] uppercase tracking-widest">Actions</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-white/5">
              {invoices.map((invoice) => (
                <tr key={invoice.id} className="hover:bg-white/2 transition-colors">
                  <td className="px-4 py-4">
                    <span className="text-[var(--text-primary)] font-mono font-bold text-sm">{invoice.invoiceNumber}</span>
                  </td>
                  <td className="px-4 py-4">
                    <Link href={`/dealer/orders/${invoice.orderId}`} className="text-[var(--text-muted)] hover:text-red-400 font-mono text-sm transition-colors">
                      {invoice.order.orderNumber}
                    </Link>
                  </td>
                  <td className="px-4 py-4 hidden md:table-cell">
                    <span className="text-[var(--text-muted)] text-sm">{formatDate(invoice.issuedAt)}</span>
                  </td>
                  <td className="px-4 py-4">
                    <span className="text-[var(--text-primary)] font-bold text-sm">{formatCurrency(invoice.grandTotal)}</span>
                  </td>
                  <td className="px-4 py-4">
                    <Link
                      href={`/dealer/invoices/${invoice.id}`}
                      className="text-red-400 hover:text-red-300 text-xs font-semibold transition-colors uppercase tracking-wider"
                    >
                      Download PDF
                    </Link>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}
    </div>
  );
}
