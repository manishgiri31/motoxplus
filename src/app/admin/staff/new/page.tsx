"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import Link from "next/link";
import { ArrowLeft } from "lucide-react";

const DEPARTMENTS = [
  { value: "SALES", label: "Sales", desc: "CRM leads, dealer list, orders" },
  { value: "MARKETING", label: "Marketing", desc: "Products, CRM leads" },
  { value: "PRODUCTION", label: "Production", desc: "Orders, products, GRN" },
  { value: "ACCOUNTS", label: "Accounts", desc: "Invoices, orders" },
];

export default function NewStaffPage() {
  const router = useRouter();
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState("");
  const [form, setForm] = useState({ name: "", email: "", password: "", confirmPassword: "", department: "" });

  function set(field: string, value: string) {
    setForm((prev) => ({ ...prev, [field]: value }));
  }

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    setError("");
    if (form.password !== form.confirmPassword) { setError("Passwords do not match"); return; }
    if (!form.department) { setError("Select a department"); return; }
    setLoading(true);
    try {
      const res = await fetch("/api/staff", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ name: form.name, email: form.email, password: form.password, department: form.department }),
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error || "Failed");
      router.push("/admin/staff");
    } catch (err: any) {
      setError(err.message);
    } finally {
      setLoading(false);
    }
  }

  return (
    <div className="max-w-lg">
      <div className="mb-8">
        <Link href="/admin/staff" className="flex items-center gap-2 text-[var(--text-muted)] hover:text-red-400 text-sm font-semibold uppercase tracking-wider mb-4 transition-colors">
          <ArrowLeft size={14} /> Back to Staff
        </Link>
        <h1 className="text-3xl font-black text-[var(--text-primary)] tracking-tight">Add Staff Member</h1>
        <p className="text-[var(--text-muted)] mt-1 text-sm">Staff can log in to the admin panel with access limited to their department.</p>
      </div>

      <form onSubmit={handleSubmit} className="space-y-5">
        {error && <div className="bg-red-900/20 border border-red-800 text-red-400 px-4 py-3 rounded-sm text-sm">{error}</div>}

        <div className="glass border border-[var(--border-color)] rounded-sm p-5 space-y-4">
          <h2 className="text-xs font-bold text-[var(--text-muted)] uppercase tracking-widest">Account Details</h2>
          <div>
            <label className="block text-xs text-[var(--text-muted)] uppercase tracking-wider mb-1.5">Full Name *</label>
            <input required className="themed-input w-full" value={form.name} onChange={(e) => set("name", e.target.value)} placeholder="Employee full name" />
          </div>
          <div>
            <label className="block text-xs text-[var(--text-muted)] uppercase tracking-wider mb-1.5">Work Email *</label>
            <input required type="email" className="themed-input w-full" value={form.email} onChange={(e) => set("email", e.target.value)} placeholder="name@motoxplus.in" />
          </div>
          <div className="grid grid-cols-2 gap-4">
            <div>
              <label className="block text-xs text-[var(--text-muted)] uppercase tracking-wider mb-1.5">Password *</label>
              <input required type="password" minLength={8} className="themed-input w-full" value={form.password} onChange={(e) => set("password", e.target.value)} placeholder="Min. 8 characters" />
            </div>
            <div>
              <label className="block text-xs text-[var(--text-muted)] uppercase tracking-wider mb-1.5">Confirm *</label>
              <input required type="password" className="themed-input w-full" value={form.confirmPassword} onChange={(e) => set("confirmPassword", e.target.value)} />
            </div>
          </div>
        </div>

        <div className="glass border border-[var(--border-color)] rounded-sm p-5">
          <h2 className="text-xs font-bold text-[var(--text-muted)] uppercase tracking-widest mb-4">Department & Access</h2>
          <div className="space-y-2">
            {DEPARTMENTS.map((d) => (
              <label key={d.value} className={`flex items-center gap-4 p-4 rounded-sm border cursor-pointer transition-all ${form.department === d.value ? "border-red-600/60 bg-red-900/10" : "border-[var(--border-color)] hover:border-red-900/30"}`}>
                <input type="radio" name="department" value={d.value} checked={form.department === d.value} onChange={() => set("department", d.value)} className="accent-red-600" />
                <div>
                  <p className="text-[var(--text-primary)] font-bold text-sm">{d.label}</p>
                  <p className="text-[var(--text-muted)] text-xs">{d.desc}</p>
                </div>
              </label>
            ))}
          </div>
        </div>

        <div className="flex gap-3">
          <button type="submit" disabled={loading} className="flex-1 bg-red-600 hover:bg-red-700 disabled:opacity-50 text-white font-bold py-3 rounded-sm text-sm uppercase tracking-wider transition-colors">
            {loading ? "Creating..." : "Create Staff Account"}
          </button>
          <Link href="/admin/staff" className="glass border border-[var(--border-color)] text-[var(--text-muted)] font-bold px-6 py-3 rounded-sm text-sm uppercase tracking-wider hover:border-red-900/40 transition-colors">
            Cancel
          </Link>
        </div>
      </form>
    </div>
  );
}
