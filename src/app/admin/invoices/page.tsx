import { prisma } from "@/lib/prisma";
import { formatCurrency, formatDate } from "@/lib/utils";
import Link from "next/link";
import { FileText } from "lucide-react";

const paymentStatusColors: Record<string, string> = {
  PENDING: "bg-yellow-900/20 text-yellow-400",
  PARTIAL: "bg-blue-900/20 text-blue-400",
  PAID: "bg-green-900/20 text-green-400",
  REFUNDED: "bg-purple-900/20 text-purple-400",
  FAILED: "bg-red-900/20 text-red-400",
};

export default async function AdminInvoicesPage(
  props: {
    searchParams: Promise<{ page?: string; q?: string }>;
  }
) {
  const searchParams = await props.searchParams;
  const page = parseInt(searchParams.page || "1");
  const pageSize = 25;
  const q = searchParams.q?.trim();

  const where: any = q
    ? {
        OR: [
          { invoiceNumber: { contains: q, mode: "insensitive" } },
          { order: { orderNumber: { contains: q, mode: "insensitive" } } },
          { dealer: { companyName: { contains: q, mode: "insensitive" } } },
        ],
      }
    : {};

  const [invoices, total] = await Promise.all([
    prisma.invoice.findMany({
      where,
      include: {
        order: { select: { orderNumber: true, paymentStatus: true, amountDue: true } },
        dealer: { select: { companyName: true, ownerName: true } },
      },
      orderBy: { issuedAt: "desc" },
      skip: (page - 1) * pageSize,
      take: pageSize,
    }),
    prisma.invoice.count({ where }),
  ]);

  const totalPages = Math.ceil(total / pageSize);

  return (
    <div>
      <div className="mb-8 flex items-center justify-between flex-wrap gap-4">
        <div>
          <h1 className="text-3xl font-black text-[var(--text-primary)] tracking-tight">Invoices</h1>
          <p className="text-[var(--text-muted)] mt-1">{total} total invoice{total !== 1 ? "s" : ""}</p>
        </div>

        {/* Search */}
        <form method="GET" className="flex gap-2">
          <input
            name="q"
            defaultValue={q}
            placeholder="Search invoice, order, dealer…"
            className="themed-input px-3 py-2 text-sm rounded-sm w-64"
          />
          <button
            type="submit"
            className="px-4 py-2 bg-red-600 hover:bg-red-700 text-white text-sm font-semibold rounded-sm transition-colors"
          >
            Search
          </button>
          {q && (
            <Link
              href="/admin/invoices"
              className="px-4 py-2 glass border border-[var(--border-color)] text-[var(--text-muted)] text-sm rounded-sm hover:border-red-600/50 transition-colors"
            >
              Clear
            </Link>
          )}
        </form>
      </div>

      {invoices.length === 0 ? (
        <div className="text-center py-20 glass border border-[var(--border-color)] rounded-sm">
          <FileText size={48} className="text-gray-700 mx-auto mb-4" />
          <h2 className="text-[var(--text-primary)] font-bold text-xl mb-2">
            {q ? "No invoices match your search" : "No invoices yet"}
          </h2>
          <p className="text-[var(--text-muted)]">
            {q ? "Try a different search term." : "Invoices are generated when orders are confirmed."}
          </p>
        </div>
      ) : (
        <div className="glass border border-[var(--border-color)] rounded-sm overflow-hidden">
          <table className="w-full">
            <thead>
              <tr className="border-b border-[var(--border-color)]">
                <th className="px-4 py-3 text-left text-xs text-[var(--text-muted)] uppercase tracking-widest">Invoice #</th>
                <th className="px-4 py-3 text-left text-xs text-[var(--text-muted)] uppercase tracking-widest hidden md:table-cell">Dealer</th>
                <th className="px-4 py-3 text-left text-xs text-[var(--text-muted)] uppercase tracking-widest hidden lg:table-cell">Order</th>
                <th className="px-4 py-3 text-left text-xs text-[var(--text-muted)] uppercase tracking-widest hidden md:table-cell">Date</th>
                <th className="px-4 py-3 text-left text-xs text-[var(--text-muted)] uppercase tracking-widest">Amount</th>
                <th className="px-4 py-3 text-left text-xs text-[var(--text-muted)] uppercase tracking-widest">Payment</th>
                <th className="px-4 py-3 text-left text-xs text-[var(--text-muted)] uppercase tracking-widest">Actions</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-white/5">
              {invoices.map((invoice) => (
                <tr key={invoice.id} className="hover:bg-white/2 transition-colors">
                  <td className="px-4 py-4">
                    <span className="text-[var(--text-primary)] font-mono font-bold text-sm">
                      {invoice.invoiceNumber}
                    </span>
                  </td>
                  <td className="px-4 py-4 hidden md:table-cell">
                    <div className="text-[var(--text-primary)] text-sm font-semibold">{invoice.dealer.companyName}</div>
                    <div className="text-[var(--text-muted)] text-xs">{invoice.dealer.ownerName}</div>
                  </td>
                  <td className="px-4 py-4 hidden lg:table-cell">
                    <Link
                      href={`/admin/orders/${invoice.orderId}`}
                      className="text-[var(--text-muted)] hover:text-red-400 font-mono text-xs transition-colors"
                    >
                      {invoice.order.orderNumber}
                    </Link>
                  </td>
                  <td className="px-4 py-4 hidden md:table-cell">
                    <span className="text-[var(--text-muted)] text-sm">{formatDate(invoice.issuedAt)}</span>
                  </td>
                  <td className="px-4 py-4">
                    <div className="text-[var(--text-primary)] font-bold text-sm">{formatCurrency(invoice.grandTotal)}</div>
                    {invoice.order.amountDue > 0 && (
                      <div className="text-red-400 text-xs">Due: {formatCurrency(invoice.order.amountDue)}</div>
                    )}
                  </td>
                  <td className="px-4 py-4">
                    <span className={`text-[10px] font-bold uppercase tracking-widest px-2 py-1 rounded-sm ${paymentStatusColors[invoice.order.paymentStatus] || "bg-gray-900/20 text-[var(--text-muted)]"}`}>
                      {invoice.order.paymentStatus}
                    </span>
                  </td>
                  <td className="px-4 py-4">
                    <Link
                      href={`/admin/invoices/${invoice.id}`}
                      className="text-red-400 hover:text-red-300 text-xs font-semibold transition-colors uppercase tracking-wider"
                    >
                      View PDF
                    </Link>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}

      {totalPages > 1 && (
        <div className="flex items-center justify-center gap-2 mt-8">
          {Array.from({ length: totalPages }, (_, i) => i + 1).map((p) => (
            <Link
              key={p}
              href={`/admin/invoices?page=${p}${q ? `&q=${encodeURIComponent(q)}` : ""}`}
              className={`w-10 h-10 flex items-center justify-center rounded-sm text-sm font-bold transition-colors ${
                p === page
                  ? "bg-red-600 text-white"
                  : "glass border border-[var(--border-color)] text-[var(--text-muted)] hover:border-red-600/50"
              }`}
            >
              {p}
            </Link>
          ))}
        </div>
      )}
    </div>
  );
}
