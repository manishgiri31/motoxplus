"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { CheckCircle } from "lucide-react";

const CATEGORIES = [
  { value: "RAW_MATERIALS", label: "Raw Materials" },
  { value: "PACKAGING", label: "Packaging" },
  { value: "PRINTING", label: "Printing" },
  { value: "LOGISTICS", label: "Logistics & Transport" },
  { value: "MANUFACTURING_COMPONENTS", label: "Manufacturing Components" },
  { value: "TOOLING", label: "Tooling & Equipment" },
  { value: "SERVICES", label: "Services" },
];

const INDIAN_STATES = [
  "Andhra Pradesh", "Arunachal Pradesh", "Assam", "Bihar", "Chhattisgarh",
  "Goa", "Gujarat", "Haryana", "Himachal Pradesh", "Jharkhand", "Karnataka",
  "Kerala", "Madhya Pradesh", "Maharashtra", "Manipur", "Meghalaya", "Mizoram",
  "Nagaland", "Odisha", "Punjab", "Rajasthan", "Sikkim", "Tamil Nadu",
  "Telangana", "Tripura", "Uttar Pradesh", "Uttarakhand", "West Bengal",
  "Delhi", "Chandigarh", "Puducherry",
];

export function VendorRegistrationForm() {
  const router = useRouter();
  const [form, setForm] = useState({
    companyName: "",
    ownerName: "",
    email: "",
    phone: "",
    password: "",
    confirmPassword: "",
    category: "",
    gstNumber: "",
    panNumber: "",
    aadhaarNumber: "",
    state: "",
    city: "",
    companyAddress: "",
    shopAddress: "",
    pincode: "",
    website: "",
    notes: "",
  });
  const [status, setStatus] = useState<"idle" | "loading" | "success" | "error">("idle");
  const [errorMsg, setErrorMsg] = useState("");
  const [userId, setUserId] = useState("");

  function set(field: string, value: string) {
    setForm((prev) => ({ ...prev, [field]: value }));
  }

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    setErrorMsg("");
    if (form.password !== form.confirmPassword) {
      setErrorMsg("Passwords do not match");
      return;
    }
    setStatus("loading");
    try {
      const body: any = {
        companyName: form.companyName,
        ownerName: form.ownerName,
        email: form.email,
        phone: form.phone,
        password: form.password,
        category: form.category,
        state: form.state,
        city: form.city,
      };
      if (form.companyAddress) body.companyAddress = form.companyAddress;
      if (form.shopAddress) body.shopAddress = form.shopAddress;
      if (form.pincode) body.pincode = form.pincode;
      if (form.gstNumber) body.gstNumber = form.gstNumber.toUpperCase();
      if (form.panNumber) body.panNumber = form.panNumber.toUpperCase();
      if (form.aadhaarNumber) body.aadhaarNumber = form.aadhaarNumber;
      if (form.website) body.website = form.website;
      if (form.notes) body.notes = form.notes;

      const res = await fetch("/api/vendor/register", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(body),
      });
      const data = await res.json();
      if (!res.ok) {
        setErrorMsg(data.error || "Registration failed");
        setStatus("error");
        return;
      }
      setUserId(data.userId);
      setStatus("success");
    } catch {
      setErrorMsg("Something went wrong. Please try again.");
      setStatus("error");
    }
  }

  if (status === "success") {
    return (
      <div className="glass border border-[var(--border-color)] rounded-sm p-12 text-center">
        <div className="w-16 h-16 bg-green-900/20 border border-green-700/30 rounded-full flex items-center justify-center mx-auto mb-6">
          <CheckCircle size={32} className="text-green-500" />
        </div>
        <h2 className="text-2xl font-black text-[var(--text-primary)] mb-3">Application Submitted!</h2>
        <p className="text-[var(--text-muted)] mb-6 leading-relaxed">
          Your vendor application has been received. Please verify your email to continue —
          we&apos;ve sent a code to {form.email}.
        </p>
        <div className="glass border border-[var(--border-color)] rounded-sm p-4 text-left mb-6">
          <div className="text-[var(--text-muted)] text-xs uppercase tracking-widest mb-2">What happens next?</div>
          {[
            "Verify your email address",
            "Verify your mobile number",
            "Application review by our procurement team",
            "Approval notification — then access to the vendor portal",
          ].map((step, i) => (
            <div key={i} className="flex items-center gap-3 py-2 border-b border-[var(--border-color)] last:border-0">
              <span className="text-red-600 font-black text-sm">{i + 1}</span>
              <span className="text-[var(--text-secondary)] text-sm">{step}</span>
            </div>
          ))}
        </div>
        <button
          onClick={() => router.push(`/verify-email?userId=${userId}`)}
          className="bg-red-600 hover:bg-red-700 text-white font-bold px-8 py-3 rounded-sm transition-colors text-sm uppercase tracking-wider"
        >
          Verify Email
        </button>
      </div>
    );
  }

  const inputClass = "w-full themed-input border focus:border-red-600/60 rounded-sm px-4 py-3 text-sm outline-none transition-colors";

  return (
    <div className="glass border border-[var(--border-color)] rounded-sm p-8">
      <h2 className="text-2xl font-black text-[var(--text-primary)] mb-2">Vendor Application</h2>
      <p className="text-[var(--text-muted)] text-sm mb-8">Tell us about your business to get started.</p>

      <form onSubmit={handleSubmit} className="space-y-5">
        {/* Company */}
        <div>
          <label className="text-[var(--text-muted)] text-xs uppercase tracking-wider block mb-2">Company Name <span className="text-red-500">*</span></label>
          <input required className={inputClass} value={form.companyName} onChange={(e) => set("companyName", e.target.value)} placeholder="Your Business / Company Name" />
        </div>

        <div className="grid grid-cols-2 gap-4">
          <div>
            <label className="text-[var(--text-muted)] text-xs uppercase tracking-wider block mb-2">Owner / Contact Name <span className="text-red-500">*</span></label>
            <input required className={inputClass} value={form.ownerName} onChange={(e) => set("ownerName", e.target.value)} placeholder="Full name" />
          </div>
          <div>
            <label className="text-[var(--text-muted)] text-xs uppercase tracking-wider block mb-2">Supply Category <span className="text-red-500">*</span></label>
            <select required className={inputClass} value={form.category} onChange={(e) => set("category", e.target.value)}>
              <option value="">Select category</option>
              {CATEGORIES.map((c) => <option key={c.value} value={c.value}>{c.label}</option>)}
            </select>
          </div>
        </div>

        <div className="grid grid-cols-2 gap-4">
          <div>
            <label className="text-[var(--text-muted)] text-xs uppercase tracking-wider block mb-2">Email <span className="text-red-500">*</span></label>
            <input required type="email" className={inputClass} value={form.email} onChange={(e) => set("email", e.target.value)} placeholder="business@company.com" />
          </div>
          <div>
            <label className="text-[var(--text-muted)] text-xs uppercase tracking-wider block mb-2">Phone <span className="text-red-500">*</span></label>
            <input required type="tel" className={inputClass} value={form.phone} onChange={(e) => set("phone", e.target.value)} placeholder="+91 98765 43210" />
          </div>
        </div>

        <div className="grid grid-cols-2 gap-4">
          <div>
            <label className="text-[var(--text-muted)] text-xs uppercase tracking-wider block mb-2">Password <span className="text-red-500">*</span></label>
            <input required type="password" minLength={8} className={inputClass} value={form.password} onChange={(e) => set("password", e.target.value)} placeholder="Min. 8 characters" />
          </div>
          <div>
            <label className="text-[var(--text-muted)] text-xs uppercase tracking-wider block mb-2">Confirm Password <span className="text-red-500">*</span></label>
            <input required type="password" minLength={8} className={inputClass} value={form.confirmPassword} onChange={(e) => set("confirmPassword", e.target.value)} placeholder="Repeat password" />
          </div>
        </div>

        <div className="border-t border-[var(--border-color)] pt-4">
          <p className="text-[var(--text-muted)] text-xs uppercase tracking-widest mb-4 font-bold">Business Details (Optional)</p>
          <div className="grid grid-cols-2 gap-4 mb-4">
            <div>
              <label className="text-[var(--text-muted)] text-xs uppercase tracking-wider block mb-2">GST Number</label>
              <input className={`${inputClass} font-mono`} value={form.gstNumber} onChange={(e) => set("gstNumber", e.target.value.toUpperCase())} placeholder="22AAAAA0000A1Z5" maxLength={15} />
              <p className="text-gray-600 text-xs mt-1">Optional — provide if registered</p>
            </div>
            <div>
              <label className="text-[var(--text-muted)] text-xs uppercase tracking-wider block mb-2">PAN Number</label>
              <input className={`${inputClass} font-mono`} value={form.panNumber} onChange={(e) => set("panNumber", e.target.value.toUpperCase())} placeholder="AAAAA0000A" maxLength={10} />
            </div>
          </div>
          <div>
            <label className="text-[var(--text-muted)] text-xs uppercase tracking-wider block mb-2">Aadhaar Number</label>
            <input className={`${inputClass} font-mono`} value={form.aadhaarNumber} onChange={(e) => set("aadhaarNumber", e.target.value.replace(/\D/g, ""))} placeholder="000000000000" maxLength={12} />
            <p className="text-gray-600 text-xs mt-1">Optional — stored securely, never verified externally</p>
          </div>
        </div>

        <div className="grid grid-cols-2 gap-4">
          <div>
            <label className="text-[var(--text-muted)] text-xs uppercase tracking-wider block mb-2">State <span className="text-red-500">*</span></label>
            <select required className={inputClass} value={form.state} onChange={(e) => set("state", e.target.value)}>
              <option value="">Select State</option>
              {INDIAN_STATES.map((s) => <option key={s} value={s}>{s}</option>)}
            </select>
          </div>
          <div>
            <label className="text-[var(--text-muted)] text-xs uppercase tracking-wider block mb-2">City <span className="text-red-500">*</span></label>
            <input required className={inputClass} value={form.city} onChange={(e) => set("city", e.target.value)} placeholder="City" />
          </div>
        </div>

        <div className="grid grid-cols-2 gap-4">
          <div>
            <label className="text-[var(--text-muted)] text-xs uppercase tracking-wider block mb-2">Company Address</label>
            <input className={inputClass} value={form.companyAddress} onChange={(e) => set("companyAddress", e.target.value)} placeholder="Registered / company address (optional)" />
          </div>
          <div>
            <label className="text-[var(--text-muted)] text-xs uppercase tracking-wider block mb-2">Shop Address</label>
            <input className={inputClass} value={form.shopAddress} onChange={(e) => set("shopAddress", e.target.value)} placeholder="Shop / warehouse address (optional)" />
          </div>
        </div>

        <div className="grid grid-cols-2 gap-4">
          <div>
            <label className="text-[var(--text-muted)] text-xs uppercase tracking-wider block mb-2">Pincode</label>
            <input pattern="[0-9]{6}" maxLength={6} className={inputClass} value={form.pincode} onChange={(e) => set("pincode", e.target.value)} placeholder="000000 (optional)" />
          </div>
          <div>
            <label className="text-[var(--text-muted)] text-xs uppercase tracking-wider block mb-2">Website</label>
            <input type="url" className={inputClass} value={form.website} onChange={(e) => set("website", e.target.value)} placeholder="https://yoursite.com" />
          </div>
        </div>

        <div>
          <label className="text-[var(--text-muted)] text-xs uppercase tracking-wider block mb-2">What do you supply? (Brief description)</label>
          <textarea rows={3} className={inputClass} value={form.notes} onChange={(e) => set("notes", e.target.value)} placeholder="Describe your products or services, capacity, years in business..." />
        </div>

        {status === "error" && (
          <div className="bg-red-900/20 border border-red-900/40 rounded-sm px-4 py-3 text-red-400 text-sm">{errorMsg}</div>
        )}

        <button
          type="submit"
          disabled={status === "loading"}
          className="w-full bg-red-600 hover:bg-red-700 disabled:opacity-50 text-white font-bold py-4 rounded-sm transition-colors uppercase tracking-wider text-sm mt-2"
        >
          {status === "loading" ? "Submitting Application..." : "Submit Vendor Application"}
        </button>

        <p className="text-gray-600 text-xs text-center">
          By submitting, you agree to our vendor terms. Applications are reviewed within 3 business days.
        </p>
      </form>
    </div>
  );
}
