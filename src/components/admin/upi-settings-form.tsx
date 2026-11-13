"use client";


import { safeFetch } from "@/lib/safe-fetch";
import { useState } from "react";
import { Spinner } from "@/components/ui/spinner";
import { CheckCircle2 } from "lucide-react";
import { isNotSet } from "@/lib/payments/upi-settings";

// Amber warning shown beside a field whose stored value is missing. There is no
// fallback value: if it is blank here, it is blank for dealers too.
function NotSet({ value }: { value: string }) {
  if (!isNotSet(value)) return null;
  return <span role="alert" className="ml-2 text-amber-500 font-semibold">Not set</span>;
}

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
    const res = await safeFetch("/api/admin/settings/upi", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(form),
    });
    setSaving(false);
    if (!res.ok) {
      const d = await res.json().catch(() => ({}));
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
          <div className="w-10 h-5 bg-[var(--border-color)] peer-focus:outline-none rounded-full peer peer-checked:bg-[var(--accent)] transition-colors after:content-[''] after:absolute after:top-0.5 after:left-[2px] after:bg-white after:rounded-full after:h-4 after:w-4 after:transition-all peer-checked:after:translate-x-5" />
          <span className="ml-2 text-xs text-[var(--text-muted)]">Enable UPI</span>
        </label>
      </div>

      <div className="grid grid-cols-1 sm:grid-cols-2 gap-4 mb-4">
        <div>
          <label className="text-[var(--text-muted)] text-xs block mb-2">UPI ID *<NotSet value={form.upiId} /></label>
          <input
            type="text"
            required
            value={form.upiId}
            onChange={(e) => setForm({ ...form, upiId: e.target.value })}
            placeholder="e.g. name@bank"
            className={inputCls + " font-mono"}
          />
          <p className="text-[var(--text-muted)] text-xs mt-1">This UPI ID will appear in the QR code and payment page.</p>
        </div>
        <div>
          <label className="text-[var(--text-muted)] text-xs block mb-2">UPI Payee Name *<NotSet value={form.upiName} /></label>
          <input
            type="text"
            required
            value={form.upiName}
            onChange={(e) => setForm({ ...form, upiName: e.target.value })}
            placeholder="Registered payee name"
            className={inputCls}
          />
        </div>
      </div>

      <div className="border-t border-[var(--border-color)] pt-4 mb-4">
        <div className="text-[var(--text-muted)] text-xs mb-3">Bank Account Details</div>
        <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
          <div>
            <label className="text-[var(--text-muted)] text-xs block mb-2">Account Name<NotSet value={form.bankAccountName} /></label>
            <input type="text" value={form.bankAccountName} onChange={(e) => setForm({ ...form, bankAccountName: e.target.value })} className={inputCls} placeholder="Account holder name" />
          </div>
          <div>
            <label className="text-[var(--text-muted)] text-xs block mb-2">Account Number<NotSet value={form.bankAccountNumber} /></label>
            <input type="text" value={form.bankAccountNumber} onChange={(e) => setForm({ ...form, bankAccountNumber: e.target.value })} className={inputCls + " font-mono"} placeholder="Account number" />
          </div>
          <div>
            <label className="text-[var(--text-muted)] text-xs block mb-2">IFSC Code<NotSet value={form.bankIfsc} /></label>
            <input type="text" value={form.bankIfsc} onChange={(e) => setForm({ ...form, bankIfsc: e.target.value.toUpperCase() })} className={inputCls + " font-mono"} placeholder="IFSC code" />
          </div>
          <div>
            <label className="text-[var(--text-muted)] text-xs block mb-2">Account Type<NotSet value={form.bankAccountType} /></label>
            <input type="text" value={form.bankAccountType} onChange={(e) => setForm({ ...form, bankAccountType: e.target.value })} className={inputCls} placeholder="e.g. Current / Savings" />
          </div>
        </div>
      </div>

      {error && <p className="text-red-400 text-sm mb-3">{error}</p>}

      <button
        type="submit"
        disabled={saving}
        className="flex items-center gap-2 bg-[var(--accent)] hover:bg-[var(--accent-hover)] disabled:opacity-50 text-white font-normal py-3 px-6 rounded-pill text-sm transition-colors"
      >
        {saving ? <><Spinner size={14} /> Saving...</> : saved ? <><CheckCircle2 size={14} /> Saved!</> : "Save Settings"}
      </button>
    </form>
  );
}
