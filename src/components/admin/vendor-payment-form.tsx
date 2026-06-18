"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { PlusCircle, X, Loader2 } from "lucide-react";

const PAYMENT_MODES = ["NEFT", "RTGS", "IMPS", "UPI", "CHEQUE", "CASH", "DD"];

export function VendorPaymentForm({ vendorId }: { vendorId: string }) {
  const router = useRouter();
  const [open, setOpen] = useState(false);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState("");

  const today = new Date().toISOString().split("T")[0];
  const [form, setForm] = useState({
    amount: "",
    paymentDate: today,
    paymentMode: "NEFT",
    referenceNumber: "",
    status: "PAID",
    notes: "",
  });

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError("");
    setLoading(true);
    try {
      const res = await fetch(`/api/vendors/${vendorId}/payments`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(form),
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error || "Failed");
      setOpen(false);
      setForm({ amount: "", paymentDate: today, paymentMode: "NEFT", referenceNumber: "", status: "PAID", notes: "" });
      router.refresh();
    } catch (err: any) {
      setError(err.message);
    } finally {
      setLoading(false);
    }
  };

  const inputClass = "w-full themed-input px-3 py-2 rounded-sm text-sm";
  const labelClass = "block text-xs font-semibold text-[var(--text-muted)] uppercase tracking-wider mb-1";

  return (
    <>
      <button
        onClick={() => setOpen(true)}
        className="flex items-center gap-1.5 text-xs font-semibold text-green-400 hover:text-green-300 transition-colors uppercase tracking-wider"
      >
        <PlusCircle size={13} />
        Record Payment
      </button>

      {open && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4">
          <div className="fixed inset-0 bg-black/60 backdrop-blur-sm" onClick={() => setOpen(false)} />
          <div className="relative glass border border-[var(--border-color)] rounded-sm p-6 w-full max-w-md z-10">
            <div className="flex items-center justify-between mb-5">
              <h3 className="text-[var(--text-primary)] font-bold uppercase tracking-widest text-sm">
                Record Payment
              </h3>
              <button onClick={() => setOpen(false)}>
                <X size={18} className="text-[var(--text-muted)] hover:text-[var(--text-primary)]" />
              </button>
            </div>

            {error && (
              <div className="mb-4 px-3 py-2 bg-red-900/20 border border-red-900/40 rounded-sm text-red-400 text-xs">
                {error}
              </div>
            )}

            <form onSubmit={handleSubmit} className="space-y-4">
              <div>
                <label className={labelClass}>Amount (₹) *</label>
                <input type="number" min="1" step="0.01" className={inputClass} value={form.amount} onChange={(e) => setForm((p) => ({ ...p, amount: e.target.value }))} required placeholder="50000" />
              </div>
              <div>
                <label className={labelClass}>Payment Date *</label>
                <input type="date" className={inputClass} value={form.paymentDate} onChange={(e) => setForm((p) => ({ ...p, paymentDate: e.target.value }))} required />
              </div>
              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className={labelClass}>Mode *</label>
                  <select className={`${inputClass} themed-select`} value={form.paymentMode} onChange={(e) => setForm((p) => ({ ...p, paymentMode: e.target.value }))}>
                    {PAYMENT_MODES.map((m) => <option key={m} value={m}>{m}</option>)}
                  </select>
                </div>
                <div>
                  <label className={labelClass}>Status</label>
                  <select className={`${inputClass} themed-select`} value={form.status} onChange={(e) => setForm((p) => ({ ...p, status: e.target.value }))}>
                    <option value="PAID">Paid</option>
                    <option value="PENDING">Pending</option>
                  </select>
                </div>
              </div>
              <div>
                <label className={labelClass}>Reference No.</label>
                <input className={`${inputClass} font-mono`} value={form.referenceNumber} onChange={(e) => setForm((p) => ({ ...p, referenceNumber: e.target.value }))} placeholder="UTR / Cheque number" />
              </div>
              <div>
                <label className={labelClass}>Notes</label>
                <textarea className={`${inputClass} resize-none`} rows={2} value={form.notes} onChange={(e) => setForm((p) => ({ ...p, notes: e.target.value }))} />
              </div>
              <div className="flex gap-3 pt-2">
                <button type="submit" disabled={loading} className="flex-1 flex items-center justify-center gap-2 bg-red-600 hover:bg-red-700 disabled:opacity-50 text-white font-bold py-2.5 rounded-sm text-sm uppercase tracking-wider transition-colors">
                  {loading && <Loader2 size={14} className="animate-spin" />}
                  Save Payment
                </button>
                <button type="button" onClick={() => setOpen(false)} className="glass border border-[var(--border-color)] text-[var(--text-muted)] font-bold px-4 py-2.5 rounded-sm text-sm uppercase tracking-wider">
                  Cancel
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </>
  );
}
