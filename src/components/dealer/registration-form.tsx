"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { CheckCircle } from "lucide-react";

const INDIAN_STATES = [
  "Andhra Pradesh", "Arunachal Pradesh", "Assam", "Bihar", "Chhattisgarh",
  "Goa", "Gujarat", "Haryana", "Himachal Pradesh", "Jharkhand", "Karnataka",
  "Kerala", "Madhya Pradesh", "Maharashtra", "Manipur", "Meghalaya", "Mizoram",
  "Nagaland", "Odisha", "Punjab", "Rajasthan", "Sikkim", "Tamil Nadu",
  "Telangana", "Tripura", "Uttar Pradesh", "Uttarakhand", "West Bengal",
  "Delhi", "Chandigarh", "Puducherry",
];

export function DealerRegistrationForm() {
  const router = useRouter();
  const [formData, setFormData] = useState({
    companyName: "",
    gstNumber: "",
    panNumber: "",
    aadhaarNumber: "",
    ownerName: "",
    phone: "",
    email: "",
    password: "",
    state: "",
    city: "",
    companyAddress: "",
    shopAddress: "",
    pincode: "",
  });
  const [status, setStatus] = useState<"idle" | "loading" | "success" | "error">("idle");
  const [errorMsg, setErrorMsg] = useState("");
  const [userId, setUserId] = useState("");

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setStatus("loading");
    setErrorMsg("");

    try {
      const res = await fetch("/api/dealer/register", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(formData),
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
  };

  const update = (field: string, value: string) => {
    setFormData((prev) => ({ ...prev, [field]: value }));
  };

  if (status === "success") {
    return (
      <div className="glass border border-[var(--border-color)] rounded-xl p-12 text-center">
        <div className="w-16 h-16 bg-green-900/20 border border-green-700/30 rounded-full flex items-center justify-center mx-auto mb-6">
          <CheckCircle size={32} className="text-green-500" />
        </div>
        <h2 className="text-2xl font-black text-[var(--text-primary)] mb-3">Application Submitted!</h2>
        <p className="text-[var(--text-muted)] mb-6 leading-relaxed">
          Thank you for applying to become a MotoXPlus dealer.
          Please verify your email to continue — we&apos;ve sent a code to {formData.email}.
        </p>
        <div className="glass border border-[var(--border-color)] rounded-xl p-4 text-left mb-6">
          <div className="text-[var(--text-muted)] text-xs uppercase tracking-widest mb-2">What happens next?</div>
          {[
            "Verify your email address",
            "Verify your mobile number",
            "Application review by our dealer team",
            "Approval email — then access to dealer portal and pricing",
          ].map((step, i) => (
            <div key={i} className="flex items-center gap-3 py-2 border-b border-[var(--border-color)] last:border-0">
              <span className="text-red-600 font-black text-sm">{i + 1}</span>
              <span className="text-[var(--text-secondary)] text-sm">{step}</span>
            </div>
          ))}
        </div>
        <button
          onClick={() => router.push(`/verify-email?userId=${userId}`)}
          className="bg-red-600 hover:bg-red-700 text-white font-bold px-8 py-3 rounded-xl transition-colors text-sm uppercase tracking-wider"
        >
          Verify Email
        </button>
      </div>
    );
  }

  return (
    <div className="glass border border-[var(--border-color)] rounded-xl p-8">
      <h2 className="text-2xl font-black text-[var(--text-primary)] mb-2">Dealer Application</h2>
      <p className="text-[var(--text-muted)] text-sm mb-8">Fill in your business details to get started.</p>

      <form onSubmit={handleSubmit} className="space-y-4">
        {/* Company Name */}
        <div>
          <label className="text-[var(--text-muted)] text-xs uppercase tracking-wider block mb-2">
            Company Name <span className="text-red-500">*</span>
          </label>
          <input
            type="text"
            required
            value={formData.companyName}
            onChange={(e) => update("companyName", e.target.value)}
            className="w-full themed-input border focus:border-red-600/60 rounded-xl px-4 py-3 text-sm outline-none transition-colors"
            placeholder="Your Business Name"
          />
        </div>

        {/* GST + PAN (optional) */}
        <div className="grid grid-cols-2 gap-4">
          <div>
            <label className="text-[var(--text-muted)] text-xs uppercase tracking-wider block mb-2">
              GST Number
            </label>
            <input
              type="text"
              pattern="^[0-9]{2}[A-Z]{5}[0-9]{4}[A-Z]{1}[1-9A-Z]{1}Z[0-9A-Z]{1}$"
              value={formData.gstNumber}
              onChange={(e) => update("gstNumber", e.target.value.toUpperCase())}
              className="w-full themed-input border focus:border-red-600/60 rounded-xl px-4 py-3 text-sm outline-none transition-colors font-mono"
              placeholder="22AAAAA0000A1Z5"
              maxLength={15}
            />
            <div className="text-gray-600 text-xs mt-1">Optional — provide if registered</div>
          </div>
          <div>
            <label className="text-[var(--text-muted)] text-xs uppercase tracking-wider block mb-2">
              PAN Number
            </label>
            <input
              type="text"
              pattern="^[A-Z]{5}[0-9]{4}[A-Z]{1}$"
              value={formData.panNumber}
              onChange={(e) => update("panNumber", e.target.value.toUpperCase())}
              className="w-full themed-input border focus:border-red-600/60 rounded-xl px-4 py-3 text-sm outline-none transition-colors font-mono"
              placeholder="AAAAA0000A"
              maxLength={10}
            />
            <div className="text-gray-600 text-xs mt-1">Optional</div>
          </div>
        </div>

        {/* Owner + Phone */}
        <div className="grid grid-cols-2 gap-4">
          <div>
            <label className="text-[var(--text-muted)] text-xs uppercase tracking-wider block mb-2">
              Owner Name <span className="text-red-500">*</span>
            </label>
            <input
              type="text"
              required
              value={formData.ownerName}
              onChange={(e) => update("ownerName", e.target.value)}
              className="w-full themed-input border focus:border-red-600/60 rounded-xl px-4 py-3 text-sm outline-none transition-colors"
              placeholder="Owner / Proprietor"
            />
          </div>
          <div>
            <label className="text-[var(--text-muted)] text-xs uppercase tracking-wider block mb-2">
              Phone <span className="text-red-500">*</span>
            </label>
            <input
              type="tel"
              required
              value={formData.phone}
              onChange={(e) => update("phone", e.target.value)}
              className="w-full themed-input border focus:border-red-600/60 rounded-xl px-4 py-3 text-sm outline-none transition-colors"
              placeholder="+91 98765 43210"
            />
          </div>
        </div>

        {/* Email + Password */}
        <div className="grid grid-cols-2 gap-4">
          <div>
            <label className="text-[var(--text-muted)] text-xs uppercase tracking-wider block mb-2">
              Email <span className="text-red-500">*</span>
            </label>
            <input
              type="email"
              required
              value={formData.email}
              onChange={(e) => update("email", e.target.value)}
              className="w-full themed-input border focus:border-red-600/60 rounded-xl px-4 py-3 text-sm outline-none transition-colors"
              placeholder="dealer@company.com"
            />
          </div>
          <div>
            <label className="text-[var(--text-muted)] text-xs uppercase tracking-wider block mb-2">
              Password <span className="text-red-500">*</span>
            </label>
            <input
              type="password"
              required
              minLength={8}
              value={formData.password}
              onChange={(e) => update("password", e.target.value)}
              className="w-full themed-input border focus:border-red-600/60 rounded-xl px-4 py-3 text-sm outline-none transition-colors"
              placeholder="Min. 8 characters"
            />
          </div>
        </div>

        {/* State + City */}
        <div className="grid grid-cols-2 gap-4">
          <div>
            <label className="text-[var(--text-muted)] text-xs uppercase tracking-wider block mb-2">
              State <span className="text-red-500">*</span>
            </label>
            <select
              required
              value={formData.state}
              onChange={(e) => update("state", e.target.value)}
              className="w-full themed-input border focus:border-red-600/60 rounded-xl px-4 py-3 text-sm outline-none transition-colors"
            >
              <option value="">Select State</option>
              {INDIAN_STATES.map((s) => (
                <option key={s} value={s}>{s}</option>
              ))}
            </select>
          </div>
          <div>
            <label className="text-[var(--text-muted)] text-xs uppercase tracking-wider block mb-2">
              City <span className="text-red-500">*</span>
            </label>
            <input
              type="text"
              required
              value={formData.city}
              onChange={(e) => update("city", e.target.value)}
              className="w-full themed-input border focus:border-red-600/60 rounded-xl px-4 py-3 text-sm outline-none transition-colors"
              placeholder="City"
            />
          </div>
        </div>

        {/* Aadhaar (optional) */}
        <div>
          <label className="text-[var(--text-muted)] text-xs uppercase tracking-wider block mb-2">
            Aadhaar Number
          </label>
          <input
            type="text"
            pattern="[0-9]{12}"
            maxLength={12}
            value={formData.aadhaarNumber}
            onChange={(e) => update("aadhaarNumber", e.target.value.replace(/\D/g, ""))}
            className="w-full themed-input border focus:border-red-600/60 rounded-xl px-4 py-3 text-sm outline-none transition-colors font-mono"
            placeholder="000000000000"
          />
          <div className="text-gray-600 text-xs mt-1">Optional — stored securely, never verified externally</div>
        </div>

        {/* Address (optional) */}
        <div>
          <label className="text-[var(--text-muted)] text-xs uppercase tracking-wider block mb-2">
            Company Address
          </label>
          <input
            type="text"
            value={formData.companyAddress}
            onChange={(e) => update("companyAddress", e.target.value)}
            className="w-full themed-input border focus:border-red-600/60 rounded-xl px-4 py-3 text-sm outline-none transition-colors"
            placeholder="Registered / company address (optional)"
          />
        </div>
        <div>
          <label className="text-[var(--text-muted)] text-xs uppercase tracking-wider block mb-2">
            Shop Address
          </label>
          <input
            type="text"
            value={formData.shopAddress}
            onChange={(e) => update("shopAddress", e.target.value)}
            className="w-full themed-input border focus:border-red-600/60 rounded-xl px-4 py-3 text-sm outline-none transition-colors"
            placeholder="Shop / outlet address (optional)"
          />
        </div>
        <div>
          <label className="text-[var(--text-muted)] text-xs uppercase tracking-wider block mb-2">
            Pincode
          </label>
          <input
            type="text"
            pattern="[0-9]{6}"
            maxLength={6}
            value={formData.pincode}
            onChange={(e) => update("pincode", e.target.value)}
            className="w-full themed-input border focus:border-red-600/60 rounded-xl px-4 py-3 text-sm outline-none transition-colors"
            placeholder="000000 (optional)"
          />
        </div>

        {/* Error */}
        {status === "error" && (
          <div className="bg-red-900/20 border border-red-900/40 rounded-xl px-4 py-3 text-red-400 text-sm">
            {errorMsg}
          </div>
        )}

        <button
          type="submit"
          disabled={status === "loading"}
          className="w-full bg-red-600 hover:bg-red-700 disabled:opacity-50 text-white font-bold py-4 rounded-xl transition-colors uppercase tracking-wider text-sm mt-2"
        >
          {status === "loading" ? "Submitting Application..." : "Submit Application"}
        </button>

        <p className="text-gray-600 text-xs text-center">
          By submitting, you agree to our terms. Applications are reviewed within 2 business days.
        </p>
      </form>
    </div>
  );
}
