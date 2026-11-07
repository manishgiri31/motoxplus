import { FileText } from "lucide-react";

export default function VendorInvoicesPage() {
  return (
    <div>
      <div className="mb-8">
        <h1 className="text-3xl font-black text-[var(--text-primary)] tracking-tight">My Invoices</h1>
        <p className="text-[var(--text-muted)] mt-1">Invoices you have submitted to MOTOXPLUS</p>
      </div>
      <div className="glass border border-[var(--border-color)] rounded-sm p-16 text-center">
        <FileText size={40} className="text-gray-700 mx-auto mb-4" />
        <p className="text-[var(--text-muted)] font-semibold">No invoices yet</p>
        <p className="text-gray-700 text-sm mt-1">
          Submit invoices against your purchase orders
        </p>
      </div>
    </div>
  );
}
