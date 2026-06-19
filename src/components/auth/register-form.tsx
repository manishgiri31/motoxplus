"use client";

import { useState } from "react";
import Link from "next/link";
import { Spinner } from "@/components/ui/spinner";
import { Eye, EyeOff, ChevronDown } from "lucide-react";

const INDIAN_STATES = [
  "Andhra Pradesh","Arunachal Pradesh","Assam","Bihar","Chhattisgarh","Delhi","Goa","Gujarat",
  "Haryana","Himachal Pradesh","Jharkhand","Karnataka","Kerala","Madhya Pradesh","Maharashtra",
  "Manipur","Meghalaya","Mizoram","Nagaland","Odisha","Punjab","Rajasthan","Sikkim","Tamil Nadu",
  "Telangana","Tripura","Uttar Pradesh","Uttarakhand","West Bengal",
];

export function RegisterForm() {
  const [step, setStep] = useState(1);
  const [s1, setS1] = useState({ name: "", email: "", password: "", confirmPassword: "" });
  const [s2, setS2] = useState({ companyName: "", gstNumber: "", ownerName: "", phone: "", state: "", city: "", address: "", pincode: "" });
  const [showPw, setShowPw] = useState(false);
  const [status, setStatus] = useState<"idle" | "loading" | "success" | "error">("idle");
  const [error, setError] = useState("");
  const [userId, setUserId] = useState("");

  function handleStep1(e: React.FormEvent) {
    e.preventDefault();
    if (s1.password !== s1.confirmPassword) { setError("Passwords do not match"); return; }
    if (s1.password.length < 8) { setError("Password must be at least 8 characters"); return; }
    setError("");
    setStep(2);
  }

  async function handleStep2(e: React.FormEvent) {
    e.preventDefault();
    setStatus("loading");
    setError("");
    const res = await fetch("/api/auth/register", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ ...s1, ...s2 }),
    });
    const data = await res.json();
    if (!res.ok) { setError(data.error || "Registration failed"); setStatus("error"); return; }
    setUserId(data.userId);
    setStatus("success");
  }

  if (status === "success") {
    return (
      <div className="glass border border-[var(--border-color)] rounded-sm p-8 text-center">
        <div className="w-16 h-16 bg-green-900/30 border border-green-700/40 rounded-full flex items-center justify-center mx-auto mb-6">
          <svg className="w-8 h-8 text-green-400" fill="none" viewBox="0 0 24 24" stroke="currentColor">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M5 13l4 4L19 7" />
          </svg>
        </div>
        <h2 className="text-xl font-black text-[var(--text-primary)] mb-2">Application Submitted!</h2>
        <p className="text-[var(--text-muted)] text-sm mb-6">
          A verification email has been sent to <span className="text-white">{s1.email}</span>. Please verify your email to complete registration.
        </p>
        <Link href={`/verify-email?userId=${userId}`} className="inline-block bg-red-600 hover:bg-red-700 text-white font-bold py-3 px-8 rounded-sm transition-colors uppercase tracking-wider text-sm">
          Verify Email Now
        </Link>
      </div>
    );
  }

  const inputCls = "w-full themed-input border focus:border-red-600/60 rounded-sm px-4 py-3 text-sm outline-none transition-colors";

  return (
    <div className="glass border border-[var(--border-color)] rounded-sm p-8">
      <div className="flex items-center mb-8">
        {[1, 2].map((s, i) => (
          <div key={s} className="flex items-center flex-1">
            <div className={`w-7 h-7 rounded-full flex items-center justify-center text-xs font-bold ${s === step ? "bg-red-600 text-white" : s < step ? "bg-green-700 text-white" : "bg-[var(--border-color)] text-[var(--text-muted)]"}`}>
              {s < step ? "v" : s}
            </div>
            <span className={`ml-2 text-xs ${s === step ? "text-[var(--text-primary)]" : "text-[var(--text-muted)]"}`}>
              {s === 1 ? "Account" : "Business"}
            </span>
            {i < 1 && <div className="flex-1 mx-3 h-px bg-[var(--border-color)]" />}
          </div>
        ))}
      </div>

      {step === 1 && (
        <form onSubmit={handleStep1} className="space-y-4">
          <h1 className="text-xl font-black text-[var(--text-primary)] mb-1">Create Account</h1>
          <p className="text-[var(--text-muted)] text-sm mb-6">Apply for a dealer account with MOTOXPLUS India.</p>
          <div>
            <label className="text-[var(--text-muted)] text-xs uppercase tracking-wider block mb-2">Full Name</label>
            <input type="text" required value={s1.name} onChange={(e) => setS1({ ...s1, name: e.target.value })} className={inputCls} placeholder="Your full name" />
          </div>
          <div>
            <label className="text-[var(--text-muted)] text-xs uppercase tracking-wider block mb-2">Email Address</label>
            <input type="email" required value={s1.email} onChange={(e) => setS1({ ...s1, email: e.target.value })} className={inputCls} placeholder="you@company.com" />
          </div>
          <div>
            <label className="text-[var(--text-muted)] text-xs uppercase tracking-wider block mb-2">Password</label>
            <div className="relative">
              <input type={showPw ? "text" : "password"} required minLength={8} value={s1.password} onChange={(e) => setS1({ ...s1, password: e.target.value })} className={inputCls + " pr-12"} placeholder="Min. 8 characters" />
              <button type="button" onClick={() => setShowPw(!showPw)} className="absolute right-4 top-1/2 -translate-y-1/2 text-[var(--text-muted)]">
                {showPw ? <EyeOff size={16} /> : <Eye size={16} />}
              </button>
            </div>
          </div>
          <div>
            <label className="text-[var(--text-muted)] text-xs uppercase tracking-wider block mb-2">Confirm Password</label>
            <input type="password" required value={s1.confirmPassword} onChange={(e) => setS1({ ...s1, confirmPassword: e.target.value })} className={inputCls} placeholder="Repeat password" />
          </div>
          {error && <div className="bg-red-900/20 border border-red-900/40 rounded-sm px-4 py-3 text-red-400 text-sm">{error}</div>}
          <button type="submit" className="w-full bg-red-600 hover:bg-red-700 text-white font-bold py-4 rounded-sm transition-colors uppercase tracking-wider text-sm">
            Continue to Business Details
          </button>
        </form>
      )}

      {step === 2 && (
        <form onSubmit={handleStep2} className="space-y-4">
          <h1 className="text-xl font-black text-[var(--text-primary)] mb-1">Business Details</h1>
          <p className="text-[var(--text-muted)] text-sm mb-6">Tell us about your business.</p>
          <div>
            <label className="text-[var(--text-muted)] text-xs uppercase tracking-wider block mb-2">Company Name</label>
            <input type="text" required value={s2.companyName} onChange={(e) => setS2({ ...s2, companyName: e.target.value })} className={inputCls} placeholder="Your company name" />
          </div>
          <div className="grid grid-cols-2 gap-4">
            <div>
              <label className="text-[var(--text-muted)] text-xs uppercase tracking-wider block mb-2">GST Number</label>
              <input type="text" required value={s2.gstNumber} onChange={(e) => setS2({ ...s2, gstNumber: e.target.value.toUpperCase() })} className={inputCls + " font-mono"} placeholder="22AAAAA0000A1Z5" maxLength={15} />
            </div>
            <div>
              <label className="text-[var(--text-muted)] text-xs uppercase tracking-wider block mb-2">Mobile</label>
              <input type="tel" required value={s2.phone} onChange={(e) => setS2({ ...s2, phone: e.target.value })} className={inputCls} placeholder="10-digit number" />
            </div>
          </div>
          <div>
            <label className="text-[var(--text-muted)] text-xs uppercase tracking-wider block mb-2">Owner Name</label>
            <input type="text" required value={s2.ownerName} onChange={(e) => setS2({ ...s2, ownerName: e.target.value })} className={inputCls} placeholder="Proprietor / Director name" />
          </div>
          <div>
            <label className="text-[var(--text-muted)] text-xs uppercase tracking-wider block mb-2">Address</label>
            <input type="text" required value={s2.address} onChange={(e) => setS2({ ...s2, address: e.target.value })} className={inputCls} placeholder="Shop / Office address" />
          </div>
          <div className="grid grid-cols-3 gap-3">
            <div>
              <label className="text-[var(--text-muted)] text-xs uppercase tracking-wider block mb-2">State</label>
              <div className="relative">
                <select required value={s2.state} onChange={(e) => setS2({ ...s2, state: e.target.value })} className={inputCls + " appearance-none pr-8"}>
                  <option value="">Select</option>
                  {INDIAN_STATES.map((st) => <option key={st} value={st}>{st}</option>)}
                </select>
                <ChevronDown size={14} className="absolute right-3 top-1/2 -translate-y-1/2 text-[var(--text-muted)] pointer-events-none" />
              </div>
            </div>
            <div>
              <label className="text-[var(--text-muted)] text-xs uppercase tracking-wider block mb-2">City</label>
              <input type="text" required value={s2.city} onChange={(e) => setS2({ ...s2, city: e.target.value })} className={inputCls} placeholder="City" />
            </div>
            <div>
              <label className="text-[var(--text-muted)] text-xs uppercase tracking-wider block mb-2">Pincode</label>
              <input type="text" required value={s2.pincode} onChange={(e) => setS2({ ...s2, pincode: e.target.value })} className={inputCls + " font-mono"} placeholder="6 digits" maxLength={6} />
            </div>
          </div>
          {error && <div className="bg-red-900/20 border border-red-900/40 rounded-sm px-4 py-3 text-red-400 text-sm">{error}</div>}
          <div className="flex gap-3 mt-2">
            <button type="button" onClick={() => setStep(1)} className="flex-1 border border-[var(--border-color)] text-[var(--text-muted)] font-bold py-4 rounded-sm transition-colors text-sm">
              Back
            </button>
            <button type="submit" disabled={status === "loading"} className="flex-[2] inline-flex items-center justify-center gap-2 bg-red-600 hover:bg-red-700 disabled:opacity-50 text-white font-bold py-4 rounded-sm transition-colors uppercase tracking-wider text-sm">
              {status === "loading" ? <><Spinner size={15} /> Submitting...</> : "Submit Application"}
            </button>
          </div>
        </form>
      )}

      <div className="mt-6 pt-6 border-t border-[var(--border-color)] text-center">
        <p className="text-[var(--text-muted)] text-sm">
          Already have an account? <Link href="/login" className="text-red-400 hover:text-red-300 font-semibold">Sign In</Link>
        </p>
      </div>
    </div>
  );
}

