import { getServerSession } from "next-auth";
import { authOptions } from "@/lib/auth";
import { prisma } from "@/lib/prisma";
import { redirect } from "next/navigation";
import { formatCurrency, formatDate } from "@/lib/utils";
import { CreditCard } from "lucide-react";

export default async function VendorPaymentsPage() {
  const session = await getServerSession(authOptions);
  if (!session || session.user.role !== "VENDOR") redirect("/login");

  const vendor = await prisma.vendor.findUnique({
    where: { userId: session.user.id },
    include: {
      payments: { orderBy: { paymentDate: "desc" } },
    },
  });

  if (!vendor) redirect("/login");

  const totalPaid = vendor.payments
    .filter((p) => p.status === "PAID")
    .reduce((s, p) => s + p.amount, 0);

  return (
    <div>
      <div className="mb-8 flex items-center justify-between">
        <div>
          <h1 className="text-3xl font-black text-[var(--text-primary)] tracking-tight">Payments</h1>
          <p className="text-[var(--text-muted)] mt-1">
            Total received: <span className="text-green-400 font-bold">{formatCurrency(totalPaid)}</span>
          </p>
        </div>
      </div>

      {vendor.payments.length === 0 ? (
        <div className="glass border border-[var(--border-color)] rounded-sm p-16 text-center">
          <CreditCard size={40} className="text-gray-700 mx-auto mb-4" />
          <p className="text-[var(--text-muted)] font-semibold">No payments yet</p>
        </div>
      ) : (
        <div className="glass border border-[var(--border-color)] rounded-sm overflow-hidden">
          <table className="w-full">
            <thead>
              <tr className="border-b border-[var(--border-color)]">
                <th className="px-4 py-3 text-left text-xs text-[var(--text-muted)] uppercase tracking-widest">Date</th>
                <th className="px-4 py-3 text-left text-xs text-[var(--text-muted)] uppercase tracking-widest">Amount</th>
                <th className="px-4 py-3 text-left text-xs text-[var(--text-muted)] uppercase tracking-widest hidden md:table-cell">Mode</th>
                <th className="px-4 py-3 text-left text-xs text-[var(--text-muted)] uppercase tracking-widest hidden md:table-cell">Reference</th>
                <th className="px-4 py-3 text-left text-xs text-[var(--text-muted)] uppercase tracking-widest">Status</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-white/5">
              {vendor.payments.map((p) => (
                <tr key={p.id} className="hover:bg-white/2 transition-colors">
                  <td className="px-4 py-4">
                    <span className="text-[var(--text-primary)] text-sm">{formatDate(p.paymentDate)}</span>
                  </td>
                  <td className="px-4 py-4">
                    <span className="text-[var(--text-primary)] font-bold text-sm">{formatCurrency(p.amount)}</span>
                  </td>
                  <td className="px-4 py-4 hidden md:table-cell">
                    <span className="text-[var(--text-muted)] text-xs">{p.paymentMode}</span>
                  </td>
                  <td className="px-4 py-4 hidden md:table-cell">
                    <span className="text-[var(--text-muted)] text-xs font-mono">
                      {p.referenceNumber || "—"}
                    </span>
                  </td>
                  <td className="px-4 py-4">
                    <span className={`text-xs font-semibold uppercase tracking-wider px-2 py-1 rounded-sm ${
                      p.status === "PAID" ? "bg-green-900/20 text-green-400" : "bg-yellow-900/20 text-yellow-400"
                    }`}>
                      {p.status}
                    </span>
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
