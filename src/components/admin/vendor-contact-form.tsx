"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { UserPlus, X, Loader2 } from "lucide-react";

export function VendorContactForm({ vendorId }: { vendorId: string }) {
  const router = useRouter();
  const [open, setOpen] = useState(false);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState("");
  const [form, setForm] = useState({
    name: "",
    designation: "",
    email: "",
    phone: "",
    isPrimary: false,
  });

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError("");
    setLoading(true);
    try {
      const res = await fetch(`/api/vendors/${vendorId}/contacts`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(form),
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error || "Failed");
      setOpen(false);
      setForm({ name: "", designation: "", email: "", phone: "", isPrimary: false });
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
        className="flex items-center gap-1.5 text-xs font-semibold text-blue-400 hover:text-blue-300 transition-colors uppercase tracking-wider"
      >
        <UserPlus size={13} />
        Add Contact
      </button>

      {open && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4">
          <div className="fixed inset-0 bg-black/60 backdrop-blur-sm" onClick={() => setOpen(false)} />
          <div className="relative glass border border-[var(--border-color)] rounded-sm p-6 w-full max-w-md z-10">
            <div className="flex items-center justify-between mb-5">
              <h3 className="text-[var(--text-primary)] font-bold uppercase tracking-widest text-sm">
                Add Contact
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
                <label className={labelClass}>Full Name *</label>
                <input className={inputClass} value={form.name} onChange={(e) => setForm((p) => ({ ...p, name: e.target.value }))} required placeholder="Ramesh Kumar" />
              </div>
              <div>
                <label className={labelClass}>Designation</label>
                <input className={inputClass} value={form.designation} onChange={(e) => setForm((p) => ({ ...p, designation: e.target.value }))} placeholder="Sales Manager" />
              </div>
              <div>
                <label className={labelClass}>Phone *</label>
                <input type="tel" className={inputClass} value={form.phone} onChange={(e) => setForm((p) => ({ ...p, phone: e.target.value }))} required placeholder="+91 98765 43210" />
              </div>
              <div>
                <label className={labelClass}>Email</label>
                <input type="email" className={inputClass} value={form.email} onChange={(e) => setForm((p) => ({ ...p, email: e.target.value }))} placeholder="contact@company.com" />
              </div>
              <div className="flex items-center gap-3">
                <input type="checkbox" id="isPrimary" checked={form.isPrimary} onChange={(e) => setForm((p) => ({ ...p, isPrimary: e.target.checked }))} className="w-4 h-4 accent-red-600" />
                <label htmlFor="isPrimary" className="text-[var(--text-secondary)] text-sm cursor-pointer">
                  Set as primary contact
                </label>
              </div>
              <div className="flex gap-3 pt-2">
                <button type="submit" disabled={loading} className="flex-1 flex items-center justify-center gap-2 bg-red-600 hover:bg-red-700 disabled:opacity-50 text-white font-bold py-2.5 rounded-sm text-sm uppercase tracking-wider transition-colors">
                  {loading && <Loader2 size={14} className="animate-spin" />}
                  Add Contact
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
