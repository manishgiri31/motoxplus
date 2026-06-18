"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { Star, X, Loader2 } from "lucide-react";

interface Props {
  vendorId: string;
}

const CURRENT_PERIOD = () => {
  const d = new Date();
  const q = Math.ceil((d.getMonth() + 1) / 3);
  return `${d.getFullYear()}-Q${q}`;
};

export function VendorRatingForm({ vendorId }: Props) {
  const router = useRouter();
  const [open, setOpen] = useState(false);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState("");
  const [form, setForm] = useState({
    qualityScore: "5",
    deliveryScore: "5",
    priceScore: "5",
    period: CURRENT_PERIOD(),
    notes: "",
  });

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError("");
    setLoading(true);
    try {
      const res = await fetch(`/api/vendors/${vendorId}/ratings`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(form),
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error || "Failed");
      setOpen(false);
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
        className="flex items-center gap-1.5 text-xs font-semibold text-amber-400 hover:text-amber-300 transition-colors uppercase tracking-wider"
      >
        <Star size={12} />
        Add Rating
      </button>

      {open && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4">
          <div className="fixed inset-0 bg-black/60 backdrop-blur-sm" onClick={() => setOpen(false)} />
          <div className="relative glass border border-[var(--border-color)] rounded-sm p-6 w-full max-w-md z-10">
            <div className="flex items-center justify-between mb-5">
              <h3 className="text-[var(--text-primary)] font-bold uppercase tracking-widest text-sm">
                Vendor Rating
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
                <label className={labelClass}>Period</label>
                <input className={inputClass} value={form.period} onChange={(e) => setForm((p) => ({ ...p, period: e.target.value }))} placeholder="2026-Q2" required />
              </div>
              {[
                { key: "qualityScore", label: "Quality (0-5)" },
                { key: "deliveryScore", label: "Delivery (0-5)" },
                { key: "priceScore", label: "Pricing (0-5)" },
              ].map(({ key, label }) => (
                <div key={key}>
                  <label className={labelClass}>{label}</label>
                  <input
                    type="number"
                    min="0"
                    max="5"
                    step="0.1"
                    className={inputClass}
                    value={(form as any)[key]}
                    onChange={(e) => setForm((p) => ({ ...p, [key]: e.target.value }))}
                    required
                  />
                </div>
              ))}
              <div>
                <label className={labelClass}>Notes</label>
                <textarea className={`${inputClass} resize-none`} rows={3} value={form.notes} onChange={(e) => setForm((p) => ({ ...p, notes: e.target.value }))} placeholder="Optional feedback..." />
              </div>
              <div className="flex gap-3 pt-2">
                <button type="submit" disabled={loading} className="flex-1 flex items-center justify-center gap-2 bg-red-600 hover:bg-red-700 disabled:opacity-50 text-white font-bold py-2.5 rounded-sm text-sm uppercase tracking-wider transition-colors">
                  {loading && <Loader2 size={14} className="animate-spin" />}
                  Save Rating
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
