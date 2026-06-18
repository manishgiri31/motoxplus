"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import Link from "next/link";
import { ArrowLeft } from "lucide-react";

const SOURCES = ["REFERRAL", "WEBSITE", "COLD_CALL", "TRADE_SHOW", "SOCIAL_MEDIA", "ADVERTISEMENT", "WALK_IN", "OTHER"];
const PRIORITIES = ["LOW", "MEDIUM", "HIGH"];
const STATES = [
  "Andhra Pradesh", "Arunachal Pradesh", "Assam", "Bihar", "Chhattisgarh", "Goa", "Gujarat",
  "Haryana", "Himachal Pradesh", "Jharkhand", "Karnataka", "Kerala", "Madhya Pradesh",
  "Maharashtra", "Manipur", "Meghalaya", "Mizoram", "Nagaland", "Odisha", "Punjab",
  "Rajasthan", "Sikkim", "Tamil Nadu", "Telangana", "Tripura", "Uttar Pradesh",
  "Uttarakhand", "West Bengal", "Delhi", "Jammu and Kashmir", "Ladakh",
];

export default function NewLeadPage() {
  const router = useRouter();
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState("");
  const [form, setForm] = useState({
    companyName: "",
    ownerName: "",
    email: "",
    phone: "",
    alternatePhone: "",
    city: "",
    state: "",
    pincode: "",
    address: "",
    source: "REFERRAL",
    priority: "MEDIUM",
    estimatedValue: "",
    nextFollowUp: "",
    notes: "",
  });

  function set(field: string, value: string) {
    setForm((prev) => ({ ...prev, [field]: value }));
  }

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    setError("");
    setLoading(true);
    try {
      const body: any = {
        companyName: form.companyName,
        ownerName: form.ownerName,
        email: form.email,
        phone: form.phone,
        city: form.city,
        state: form.state,
        source: form.source,
        priority: form.priority,
      };
      if (form.alternatePhone) body.alternatePhone = form.alternatePhone;
      if (form.pincode) body.pincode = form.pincode;
      if (form.address) body.address = form.address;
      if (form.estimatedValue) body.estimatedValue = parseFloat(form.estimatedValue);
      if (form.nextFollowUp) body.nextFollowUp = form.nextFollowUp;
      if (form.notes) body.initialNote = form.notes;

      const res = await fetch("/api/crm/leads", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(body),
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error || "Failed to create lead");
      router.push(`/admin/crm/leads/${data.id}`);
    } catch (err: any) {
      setError(err.message);
    } finally {
      setLoading(false);
    }
  }

  return (
    <div className="max-w-2xl">
      <div className="mb-8">
        <Link href="/admin/crm/leads" className="flex items-center gap-2 text-[var(--text-muted)] hover:text-red-400 text-sm font-semibold uppercase tracking-wider mb-4 transition-colors">
          <ArrowLeft size={14} /> Back to Leads
        </Link>
        <h1 className="text-3xl font-black text-[var(--text-primary)] tracking-tight">Add New Lead</h1>
      </div>

      <form onSubmit={handleSubmit} className="space-y-6">
        {error && <div className="bg-red-900/20 border border-red-800 text-red-400 px-4 py-3 rounded-sm text-sm">{error}</div>}

        <div className="glass border border-[var(--border-color)] rounded-sm p-6 space-y-4">
          <h2 className="text-sm font-bold text-[var(--text-muted)] uppercase tracking-widest mb-2">Company Information</h2>
          <div>
            <label className="block text-xs text-[var(--text-muted)] uppercase tracking-wider mb-1.5">Company Name *</label>
            <input required className="themed-input w-full" value={form.companyName} onChange={(e) => set("companyName", e.target.value)} placeholder="Dealer company name" />
          </div>
          <div className="grid grid-cols-2 gap-4">
            <div>
              <label className="block text-xs text-[var(--text-muted)] uppercase tracking-wider mb-1.5">Owner / Contact Name *</label>
              <input required className="themed-input w-full" value={form.ownerName} onChange={(e) => set("ownerName", e.target.value)} placeholder="Full name" />
            </div>
            <div>
              <label className="block text-xs text-[var(--text-muted)] uppercase tracking-wider mb-1.5">Email *</label>
              <input required type="email" className="themed-input w-full" value={form.email} onChange={(e) => set("email", e.target.value)} placeholder="contact@company.com" />
            </div>
          </div>
          <div className="grid grid-cols-2 gap-4">
            <div>
              <label className="block text-xs text-[var(--text-muted)] uppercase tracking-wider mb-1.5">Phone *</label>
              <input required className="themed-input w-full" value={form.phone} onChange={(e) => set("phone", e.target.value)} placeholder="+91 98765 43210" />
            </div>
            <div>
              <label className="block text-xs text-[var(--text-muted)] uppercase tracking-wider mb-1.5">Alternate Phone</label>
              <input className="themed-input w-full" value={form.alternatePhone} onChange={(e) => set("alternatePhone", e.target.value)} />
            </div>
          </div>
        </div>

        <div className="glass border border-[var(--border-color)] rounded-sm p-6 space-y-4">
          <h2 className="text-sm font-bold text-[var(--text-muted)] uppercase tracking-widest mb-2">Location</h2>
          <div className="grid grid-cols-2 gap-4">
            <div>
              <label className="block text-xs text-[var(--text-muted)] uppercase tracking-wider mb-1.5">City *</label>
              <input required className="themed-input w-full" value={form.city} onChange={(e) => set("city", e.target.value)} />
            </div>
            <div>
              <label className="block text-xs text-[var(--text-muted)] uppercase tracking-wider mb-1.5">State *</label>
              <select required className="themed-select w-full" value={form.state} onChange={(e) => set("state", e.target.value)}>
                <option value="">Select state</option>
                {STATES.map((s) => <option key={s} value={s}>{s}</option>)}
              </select>
            </div>
          </div>
          <div className="grid grid-cols-2 gap-4">
            <div>
              <label className="block text-xs text-[var(--text-muted)] uppercase tracking-wider mb-1.5">Pincode</label>
              <input className="themed-input w-full" value={form.pincode} onChange={(e) => set("pincode", e.target.value)} maxLength={6} />
            </div>
            <div>
              <label className="block text-xs text-[var(--text-muted)] uppercase tracking-wider mb-1.5">Address</label>
              <input className="themed-input w-full" value={form.address} onChange={(e) => set("address", e.target.value)} />
            </div>
          </div>
        </div>

        <div className="glass border border-[var(--border-color)] rounded-sm p-6 space-y-4">
          <h2 className="text-sm font-bold text-[var(--text-muted)] uppercase tracking-widest mb-2">Lead Details</h2>
          <div className="grid grid-cols-2 gap-4">
            <div>
              <label className="block text-xs text-[var(--text-muted)] uppercase tracking-wider mb-1.5">Source *</label>
              <select required className="themed-select w-full" value={form.source} onChange={(e) => set("source", e.target.value)}>
                {SOURCES.map((s) => <option key={s} value={s}>{s.replace(/_/g, " ")}</option>)}
              </select>
            </div>
            <div>
              <label className="block text-xs text-[var(--text-muted)] uppercase tracking-wider mb-1.5">Priority</label>
              <select className="themed-select w-full" value={form.priority} onChange={(e) => set("priority", e.target.value)}>
                {PRIORITIES.map((p) => <option key={p} value={p}>{p}</option>)}
              </select>
            </div>
          </div>
          <div className="grid grid-cols-2 gap-4">
            <div>
              <label className="block text-xs text-[var(--text-muted)] uppercase tracking-wider mb-1.5">Estimated Monthly Value (₹)</label>
              <input type="number" min="0" className="themed-input w-full" value={form.estimatedValue} onChange={(e) => set("estimatedValue", e.target.value)} placeholder="0" />
            </div>
            <div>
              <label className="block text-xs text-[var(--text-muted)] uppercase tracking-wider mb-1.5">Next Follow-up Date</label>
              <input type="date" className="themed-input w-full" value={form.nextFollowUp} onChange={(e) => set("nextFollowUp", e.target.value)} />
            </div>
          </div>
          <div>
            <label className="block text-xs text-[var(--text-muted)] uppercase tracking-wider mb-1.5">Initial Note</label>
            <textarea rows={3} className="themed-input w-full" value={form.notes} onChange={(e) => set("notes", e.target.value)} placeholder="First contact context, what they're looking for..." />
          </div>
        </div>

        <div className="flex gap-3">
          <button type="submit" disabled={loading} className="flex-1 bg-red-600 hover:bg-red-700 disabled:opacity-50 text-white font-bold py-3 rounded-sm text-sm uppercase tracking-wider transition-colors">
            {loading ? "Creating..." : "Create Lead"}
          </button>
          <Link href="/admin/crm/leads" className="glass border border-[var(--border-color)] text-[var(--text-muted)] font-bold px-6 py-3 rounded-sm text-sm uppercase tracking-wider hover:border-red-900/40 transition-colors">
            Cancel
          </Link>
        </div>
      </form>
    </div>
  );
}
