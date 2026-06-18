"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { X, UserCheck } from "lucide-react";

interface Props {
  leadId: string;
  companyName: string;
  ownerName: string;
  email: string;
  onClose: () => void;
}

export function ConvertLeadForm({ leadId, companyName, ownerName, email, onClose }: Props) {
  const router = useRouter();
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState("");
  const [form, setForm] = useState({
    gstNumber: "",
    address: "",
    pincode: "",
    creditLimit: "",
    password: "",
    confirmPassword: "",
  });

  function set(field: string, value: string) {
    setForm((prev) => ({ ...prev, [field]: value }));
  }

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    setError("");
    if (form.password !== form.confirmPassword) {
      setError("Passwords do not match");
      return;
    }
    if (form.password.length < 8) {
      setError("Password must be at least 8 characters");
      return;
    }
    setLoading(true);
    try {
      const res = await fetch(`/api/crm/leads/${leadId}/convert`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          gstNumber: form.gstNumber,
          address: form.address,
          pincode: form.pincode,
          creditLimit: form.creditLimit || undefined,
          password: form.password,
        }),
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error || "Conversion failed");
      router.push(`/admin/dealers/${data.dealer.id}`);
    } catch (err: any) {
      setError(err.message);
    } finally {
      setLoading(false);
    }
  }

  return (
    <div className="fixed inset-0 bg-black/60 backdrop-blur-sm z-50 flex items-center justify-center p-4">
      <div className="glass border border-[var(--border-color)] rounded-sm w-full max-w-lg">
        <div className="flex items-center justify-between px-6 py-4 border-b border-[var(--border-color)]">
          <div className="flex items-center gap-2">
            <UserCheck size={18} className="text-green-400" />
            <h2 className="text-lg font-black text-[var(--text-primary)] uppercase tracking-tight">Convert to Dealer</h2>
          </div>
          <button onClick={onClose} className="text-[var(--text-muted)] hover:text-white transition-colors"><X size={18} /></button>
        </div>

        <div className="px-6 py-3 bg-green-900/10 border-b border-green-900/30">
          <p className="text-green-400 text-sm font-semibold">{companyName}</p>
          <p className="text-[var(--text-muted)] text-xs">{ownerName} · {email}</p>
        </div>

        <form onSubmit={handleSubmit} className="p-6 space-y-4">
          {error && <div className="bg-red-900/20 border border-red-800 text-red-400 px-3 py-2 rounded-sm text-sm">{error}</div>}

          <div>
            <label className="block text-xs text-[var(--text-muted)] uppercase tracking-wider mb-1.5">GST Number *</label>
            <input required className="themed-input w-full" value={form.gstNumber} onChange={(e) => set("gstNumber", e.target.value)} placeholder="22AAAAA0000A1Z5" maxLength={15} />
          </div>

          <div>
            <label className="block text-xs text-[var(--text-muted)] uppercase tracking-wider mb-1.5">Business Address *</label>
            <textarea required rows={2} className="themed-input w-full" value={form.address} onChange={(e) => set("address", e.target.value)} placeholder="Full business address" />
          </div>

          <div className="grid grid-cols-2 gap-4">
            <div>
              <label className="block text-xs text-[var(--text-muted)] uppercase tracking-wider mb-1.5">Pincode *</label>
              <input required className="themed-input w-full" value={form.pincode} onChange={(e) => set("pincode", e.target.value)} maxLength={6} />
            </div>
            <div>
              <label className="block text-xs text-[var(--text-muted)] uppercase tracking-wider mb-1.5">Credit Limit (₹)</label>
              <input type="number" min="0" className="themed-input w-full" value={form.creditLimit} onChange={(e) => set("creditLimit", e.target.value)} placeholder="0" />
            </div>
          </div>

          <div className="border-t border-[var(--border-color)] pt-4">
            <p className="text-xs text-[var(--text-muted)] uppercase tracking-wider mb-3 font-bold">Portal Access Password</p>
            <div className="grid grid-cols-2 gap-4">
              <div>
                <label className="block text-xs text-[var(--text-muted)] uppercase tracking-wider mb-1.5">Password *</label>
                <input required type="password" className="themed-input w-full" value={form.password} onChange={(e) => set("password", e.target.value)} minLength={8} />
              </div>
              <div>
                <label className="block text-xs text-[var(--text-muted)] uppercase tracking-wider mb-1.5">Confirm *</label>
                <input required type="password" className="themed-input w-full" value={form.confirmPassword} onChange={(e) => set("confirmPassword", e.target.value)} />
              </div>
            </div>
          </div>

          <div className="flex gap-3 pt-2">
            <button type="submit" disabled={loading} className="flex-1 bg-green-700 hover:bg-green-600 disabled:opacity-50 text-white font-bold py-2.5 rounded-sm text-sm uppercase tracking-wider transition-colors">
              {loading ? "Converting..." : "Convert & Create Account"}
            </button>
            <button type="button" onClick={onClose} className="glass border border-[var(--border-color)] text-[var(--text-muted)] font-bold px-5 py-2.5 rounded-sm text-sm uppercase tracking-wider hover:border-red-900/40 transition-colors">
              Cancel
            </button>
          </div>
        </form>
      </div>
    </div>
  );
}
