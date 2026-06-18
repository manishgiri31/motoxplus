"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import Link from "next/link";
import { ArrowLeft, Loader2 } from "lucide-react";

const CATEGORIES = [
  { value: "RAW_MATERIALS", label: "Raw Materials" },
  { value: "PACKAGING", label: "Packaging" },
  { value: "PRINTING", label: "Printing" },
  { value: "LOGISTICS", label: "Logistics" },
  { value: "MANUFACTURING_COMPONENTS", label: "Manufacturing Components" },
  { value: "TOOLING", label: "Tooling" },
  { value: "SERVICES", label: "Services" },
];

const STATES = [
  "Andhra Pradesh","Arunachal Pradesh","Assam","Bihar","Chhattisgarh","Goa","Gujarat",
  "Haryana","Himachal Pradesh","Jharkhand","Karnataka","Kerala","Madhya Pradesh",
  "Maharashtra","Manipur","Meghalaya","Mizoram","Nagaland","Odisha","Punjab",
  "Rajasthan","Sikkim","Tamil Nadu","Telangana","Tripura","Uttar Pradesh",
  "Uttarakhand","West Bengal","Delhi","Jammu and Kashmir","Ladakh","Chandigarh",
];

export default function NewVendorPage() {
  const router = useRouter();
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState("");
  const [createPortal, setCreatePortal] = useState(false);

  const [form, setForm] = useState({
    companyName: "",
    ownerName: "",
    email: "",
    phone: "",
    category: "",
    gstNumber: "",
    panNumber: "",
    address: "",
    city: "",
    state: "",
    pincode: "",
    website: "",
    creditDays: "30",
    bankName: "",
    accountNumber: "",
    ifscCode: "",
    notes: "",
    password: "",
  });

  const set = (field: string, value: string) =>
    setForm((prev) => ({ ...prev, [field]: value }));

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError("");
    setLoading(true);

    try {
      const res = await fetch("/api/vendors", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ ...form, createPortalAccess: createPortal }),
      });

      const data = await res.json();
      if (!res.ok) throw new Error(data.error || "Failed to create vendor");

      router.push(`/admin/vendors/${data.id}`);
    } catch (err: any) {
      setError(err.message);
    } finally {
      setLoading(false);
    }
  };

  const inputClass =
    "w-full themed-input px-3 py-2.5 rounded-sm text-sm focus:ring-0 transition-colors";
  const labelClass = "block text-xs font-semibold text-[var(--text-muted)] uppercase tracking-wider mb-1.5";

  return (
    <div className="max-w-4xl">
      <div className="mb-8 flex items-center gap-4">
        <Link
          href="/admin/vendors"
          className="glass border border-[var(--border-color)] p-2 rounded-sm hover:border-red-900/40 transition-colors"
        >
          <ArrowLeft size={18} className="text-[var(--text-muted)]" />
        </Link>
        <div>
          <h1 className="text-3xl font-black text-[var(--text-primary)] tracking-tight">Add Vendor</h1>
          <p className="text-[var(--text-muted)] mt-1">Register a new vendor in the system</p>
        </div>
      </div>

      {error && (
        <div className="mb-6 px-4 py-3 bg-red-900/20 border border-red-900/40 rounded-sm text-red-400 text-sm">
          {error}
        </div>
      )}

      <form onSubmit={handleSubmit} className="space-y-6">
        {/* Basic Info */}
        <div className="glass border border-[var(--border-color)] rounded-sm p-6">
          <h2 className="text-[var(--text-primary)] font-bold mb-5 text-sm uppercase tracking-widest">
            Basic Information
          </h2>
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            <div>
              <label className={labelClass}>Company Name *</label>
              <input
                className={inputClass}
                value={form.companyName}
                onChange={(e) => set("companyName", e.target.value)}
                required
                placeholder="Sharma Steel Pvt Ltd"
              />
            </div>
            <div>
              <label className={labelClass}>Owner / Contact Name *</label>
              <input
                className={inputClass}
                value={form.ownerName}
                onChange={(e) => set("ownerName", e.target.value)}
                required
                placeholder="Ramesh Sharma"
              />
            </div>
            <div>
              <label className={labelClass}>Email *</label>
              <input
                type="email"
                className={inputClass}
                value={form.email}
                onChange={(e) => set("email", e.target.value)}
                required
                placeholder="vendor@company.com"
              />
            </div>
            <div>
              <label className={labelClass}>Phone *</label>
              <input
                type="tel"
                className={inputClass}
                value={form.phone}
                onChange={(e) => set("phone", e.target.value)}
                required
                placeholder="+91 98765 43210"
              />
            </div>
            <div>
              <label className={labelClass}>Category *</label>
              <select
                className={`${inputClass} themed-select`}
                value={form.category}
                onChange={(e) => set("category", e.target.value)}
                required
              >
                <option value="">Select category</option>
                {CATEGORIES.map((c) => (
                  <option key={c.value} value={c.value}>
                    {c.label}
                  </option>
                ))}
              </select>
            </div>
            <div>
              <label className={labelClass}>GST Number</label>
              <input
                className={`${inputClass} font-mono`}
                value={form.gstNumber}
                onChange={(e) => set("gstNumber", e.target.value.toUpperCase())}
                placeholder="27AABCU9603R1ZX"
                maxLength={15}
              />
            </div>
            <div>
              <label className={labelClass}>PAN Number</label>
              <input
                className={`${inputClass} font-mono`}
                value={form.panNumber}
                onChange={(e) => set("panNumber", e.target.value.toUpperCase())}
                placeholder="AABCU9603R"
                maxLength={10}
              />
            </div>
            <div>
              <label className={labelClass}>Credit Days</label>
              <input
                type="number"
                min={0}
                max={180}
                className={inputClass}
                value={form.creditDays}
                onChange={(e) => set("creditDays", e.target.value)}
              />
            </div>
          </div>
        </div>

        {/* Address */}
        <div className="glass border border-[var(--border-color)] rounded-sm p-6">
          <h2 className="text-[var(--text-primary)] font-bold mb-5 text-sm uppercase tracking-widest">
            Address
          </h2>
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            <div className="md:col-span-2">
              <label className={labelClass}>Street Address *</label>
              <input
                className={inputClass}
                value={form.address}
                onChange={(e) => set("address", e.target.value)}
                required
                placeholder="Plot 12, MIDC Industrial Area"
              />
            </div>
            <div>
              <label className={labelClass}>City *</label>
              <input
                className={inputClass}
                value={form.city}
                onChange={(e) => set("city", e.target.value)}
                required
                placeholder="Pune"
              />
            </div>
            <div>
              <label className={labelClass}>State *</label>
              <select
                className={`${inputClass} themed-select`}
                value={form.state}
                onChange={(e) => set("state", e.target.value)}
                required
              >
                <option value="">Select state</option>
                {STATES.map((s) => (
                  <option key={s} value={s}>
                    {s}
                  </option>
                ))}
              </select>
            </div>
            <div>
              <label className={labelClass}>Pincode *</label>
              <input
                className={inputClass}
                value={form.pincode}
                onChange={(e) => set("pincode", e.target.value)}
                required
                maxLength={6}
                placeholder="411001"
              />
            </div>
            <div>
              <label className={labelClass}>Website</label>
              <input
                type="url"
                className={inputClass}
                value={form.website}
                onChange={(e) => set("website", e.target.value)}
                placeholder="https://company.com"
              />
            </div>
          </div>
        </div>

        {/* Bank Details */}
        <div className="glass border border-[var(--border-color)] rounded-sm p-6">
          <h2 className="text-[var(--text-primary)] font-bold mb-5 text-sm uppercase tracking-widest">
            Bank Details
          </h2>
          <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
            <div>
              <label className={labelClass}>Bank Name</label>
              <input
                className={inputClass}
                value={form.bankName}
                onChange={(e) => set("bankName", e.target.value)}
                placeholder="State Bank of India"
              />
            </div>
            <div>
              <label className={labelClass}>Account Number</label>
              <input
                className={`${inputClass} font-mono`}
                value={form.accountNumber}
                onChange={(e) => set("accountNumber", e.target.value)}
                placeholder="000123456789"
              />
            </div>
            <div>
              <label className={labelClass}>IFSC Code</label>
              <input
                className={`${inputClass} font-mono`}
                value={form.ifscCode}
                onChange={(e) => set("ifscCode", e.target.value.toUpperCase())}
                placeholder="SBIN0001234"
                maxLength={11}
              />
            </div>
          </div>
        </div>

        {/* Notes */}
        <div className="glass border border-[var(--border-color)] rounded-sm p-6">
          <h2 className="text-[var(--text-primary)] font-bold mb-5 text-sm uppercase tracking-widest">
            Internal Notes
          </h2>
          <textarea
            className={`${inputClass} resize-none`}
            rows={3}
            value={form.notes}
            onChange={(e) => set("notes", e.target.value)}
            placeholder="Any notes about this vendor..."
          />
        </div>

        {/* Portal Access */}
        <div className="glass border border-[var(--border-color)] rounded-sm p-6">
          <div className="flex items-center gap-3 mb-4">
            <input
              type="checkbox"
              id="createPortal"
              checked={createPortal}
              onChange={(e) => setCreatePortal(e.target.checked)}
              className="w-4 h-4 accent-red-600"
            />
            <label htmlFor="createPortal" className="text-[var(--text-primary)] text-sm font-semibold cursor-pointer">
              Create vendor portal access
            </label>
          </div>
          {createPortal && (
            <div>
              <label className={labelClass}>Temporary Password *</label>
              <input
                type="password"
                className={inputClass}
                value={form.password}
                onChange={(e) => set("password", e.target.value)}
                required={createPortal}
                placeholder="Set initial password for vendor"
                minLength={8}
              />
              <p className="text-[var(--text-muted)] text-xs mt-1.5">
                The vendor will use their email + this password to log in to the vendor portal.
              </p>
            </div>
          )}
        </div>

        <div className="flex gap-3">
          <button
            type="submit"
            disabled={loading}
            className="flex items-center gap-2 bg-red-600 hover:bg-red-700 disabled:opacity-50 text-white font-bold px-6 py-3 rounded-sm text-sm transition-colors uppercase tracking-wider"
          >
            {loading && <Loader2 size={16} className="animate-spin" />}
            {loading ? "Creating..." : "Create Vendor"}
          </button>
          <Link
            href="/admin/vendors"
            className="glass border border-[var(--border-color)] hover:border-red-900/40 text-[var(--text-muted)] font-bold px-6 py-3 rounded-sm text-sm transition-colors uppercase tracking-wider"
          >
            Cancel
          </Link>
        </div>
      </form>
    </div>
  );
}
