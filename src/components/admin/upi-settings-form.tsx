"use client";

import { useState } from "react";
import { Spinner } from "@/components/ui/spinner";
import { CheckCircle2 } from "lucide-react";

interface Props {
  initial: {
    upiId: string;
    upiName: string;
    upiEnabled: boolean;
    bankAccountName: string;
    bankAccountNumber: string;
    bankIfsc: string;
    bankAccountType: string;
  };
}

export function UpiSettingsForm({ initial }: Props) {
  const [form, setForm] = useState(initial);
  const [saving, setSaving] = useState(false);
  const [saved, setSaved] = useState(false);
  const [error, setError] = useState("");

  const handleSave = async (e: React.FormEvent) => {
    e.preventDefault();
    setSaving(true);
    setError("");
    const res = await fetch("/api/admin/settings/upi", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(form),
    });
    setSaving(false);
    if (!res.ok) {
      const d = await res.json();
      setError(d.error || "Save failed.");
      return;
    }
    setSaved(true);
    setTimeout(() => setSaved(false), 3000);
  };

  const inputCls = "w-full themed-input border rounded-xl px-4 py-3 text-sm outline-none transition-colors focus:border-red-600/60";

  return (
    <form onSubmit={handleSave} className="glass border border-[var(--border-color)] rounded-xl p-6 mb-6">
      <div className="flex items-center justify-between mb-5">
        <div>
          <h3 className="text-[var(--text-primary)] font-bold">Direct Payment Settings</h3>
          <p className="text-[var(--text-muted)] text-xs mt-0.5">UPI and bank transfer configuration for dealer payments</p>
        </div>
        <label className="relative inline-flex items-center cursor-pointer">
          <input
            type="checkbox"
            checked={form.upiEnabled}
            onChange={(e) => setForm({ ...form, upiEnabled: e.target.checked })}
            className="sr-only peer"
          />
          <div className="w-10 h-5 bg-[var(--border-color)] peer-focus:outline-none rounded-full peer peer-checked:bg-red-600 transition-colors after:content-[''] after:absolute after:top-0.5 after:left-[2px] after:bg-white after:rounded-full after:h-4 after:w-4 after:transition-all peer-checked:after:translate-x-5" />
          <span className="ml-2 text-xs text-[var(--text-muted)]">Enable UPI</span>
        </label>
      </div>

      <div className="grid grid-cols-1 sm:grid-cols-2 gap-4 mb-4">
        <div>
          <label className="text-[var(--text-muted)] text-xs uppercase tracking-wider block mb-2">UPI ID *</label>
          <input
            type="text"
            required
            value={form.upiId}
            onChange={(e) => setForm({ ...form, upiId: e.target.value })}
            placeholder="5118678468276SB1024@mairtel"
            className={inputCls + " font-mono"}
          />
          <p className="text-[var(--text-muted)] text-xs mt-1">This UPI ID will appear in the QR code and payment page.</p>
        </div>
        <div>
          <label className="text-[var(--text-muted)] text-xs uppercase tracking-wider block mb-2">UPI Payee Name *</label>
          <input
            type="text"
            required
            value={form.upiName}
            onChange={(e) => setForm({ ...form, upiName: e.target.value })}
            placeholder="MotoXPlus India Private Limited"
            className={inputCls}
          />
        </div>
      </div>

      <div className="border-t border-[var(--border-color)] pt-4 mb-4">
        <div className="text-[var(--text-muted)] text-xs uppercase tracking-wider mb-3">Bank Account Details</div>
        <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
          <div>
            <label className="text-[var(--text-muted)] text-xs block mb-2">Account Name</label>
            <input type="text" value={form.bankAccountName} onChange={(e) => setForm({ ...form, bankAccountName: e.target.value })} className={inputCls} placeholder="MotoXPlus India Private Limited" />
          </div>
          <div>
            <label className="text-[var(--text-muted)] text-xs block mb-2">Account Number</label>
            <input type="text" value={form.bankAccountNumber} onChange={(e) => setForm({ ...form, bankAccountNumber: e.target.value })} className={inputCls + " font-mono"} placeholder="7834839071" />
          </div>
          <div>
            <label className="text-[var(--text-muted)] text-xs block mb-2">IFSC Code</label>
            <input type="text" value={form.bankIfsc} onChange={(e) => setForm({ ...form, bankIfsc: e.target.value.toUpperCase() })} className={inputCls + " font-mono"} placeholder="AIRP0000001" />
          </div>
          <div>
            <label className="text-[var(--text-muted)] text-xs block mb-2">Account Type</label>
            <input type="text" value={form.bankAccountType} onChange={(e) => setForm({ ...form, bankAccountType: e.target.value })} className={inputCls} placeholder="Current" />
          </div>
        </div>
      </div>

      {error && <p className="text-red-400 text-sm mb-3">{error}</p>}

      <button
        type="submit"
        disabled={saving}
        className="flex items-center gap-2 bg-red-600 hover:bg-red-700 disabled:opacity-50 text-white font-bold py-3 px-6 rounded-xl text-sm transition-colors uppercase tracking-wider"
      >
        {saving ? <><Spinner size={14} /> Saving...</> : saved ? <><CheckCircle2 size={14} /> Saved!</> : "Save Settings"}
      </button>
    </form>
  );
}
