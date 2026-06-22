"use client";

import { useState } from "react";
import { signIn } from "next-auth/react";
import { useRouter, useSearchParams } from "next/navigation";
import Link from "next/link";
import { Eye, EyeOff, Mail, Lock, Smartphone, ShieldCheck, ChevronRight } from "lucide-react";
import { OtpInput } from "./otp-input";
import { Spinner } from "@/components/ui/spinner";
import { CountdownTimer } from "./countdown-timer";

type Tab = "password" | "otp";
type OtpStep = "enter-mobile" | "enter-otp";

export function LoginForm() {
  const router = useRouter();
  const searchParams = useSearchParams();
  const callbackUrl = searchParams.get("callbackUrl") || "/dealer/dashboard";

  const [tab, setTab] = useState<Tab>("password");

  // Email+Password state
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [showPw, setShowPw] = useState(false);

  // Mobile OTP state
  const [mobile, setMobile] = useState("");
  const [otp, setOtp] = useState("");
  const [otpStep, setOtpStep] = useState<OtpStep>("enter-mobile");
  const [timerKey, setTimerKey] = useState(0);

  const [status, setStatus] = useState<"idle" | "loading" | "error">("idle");
  const [error, setError] = useState("");

  async function handlePasswordLogin(e: React.FormEvent) {
    e.preventDefault();
    setStatus("loading"); setError("");
    const result = await signIn("credentials", { email, password, redirect: false });
    if (result?.error) { setError(result.error); setStatus("error"); return; }
    router.push(callbackUrl);
    router.refresh();
  }

  async function handleSendOTP(e: React.FormEvent) {
    e.preventDefault();
    setStatus("loading"); setError("");
    const res = await fetch("/api/auth/login-otp", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ mobile }),
    });
    const data = await res.json();
    if (!res.ok) { setError(data.error || "Failed to send OTP"); setStatus("error"); return; }
    setStatus("idle");
    setOtpStep("enter-otp");
    setTimerKey((k) => k + 1);
  }

  async function handleOTPLogin(e: React.FormEvent) {
    e.preventDefault();
    if (otp.length !== 6) { setError("Enter the 6-digit OTP"); return; }
    setStatus("loading"); setError("");
    const res = await fetch("/api/auth/login-otp", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ mobile, otp }),
    });
    const data = await res.json();
    if (!res.ok) { setError(data.error || "Invalid OTP"); setStatus("error"); return; }
    router.push(callbackUrl);
    router.refresh();
  }

  async function handleResendOTP() {
    const res = await fetch("/api/auth/login-otp", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ mobile }),
    });
    if (!res.ok) { const d = await res.json(); throw new Error(d.error || "Resend failed"); }
    setTimerKey((k) => k + 1);
  }

  const inputCls = "w-full themed-input border rounded-xl pl-11 pr-4 py-3 text-sm";

  return (
    <div className="glass border border-[var(--border-color)] rounded-2xl p-8">
      <div className="flex items-start justify-between mb-6">
        <div>
          <h1 className="text-2xl font-black text-[var(--text-primary)] mb-1">Welcome Back</h1>
          <p className="text-[var(--text-muted)] text-sm">Sign in to your MOTOXPLUS account.</p>
        </div>
        <div className="flex items-center gap-1.5 bg-green-900/20 border border-green-800/30 rounded-lg px-2.5 py-1.5 flex-shrink-0">
          <ShieldCheck size={12} className="text-green-400" />
          <span className="text-[10px] text-green-400 font-semibold tracking-wide">Secure</span>
        </div>
      </div>

      {/* Tabs */}
      <div className="flex bg-[var(--bg-secondary)] rounded-xl p-1 mb-7 border border-[var(--border-color)]">
        <button
          type="button"
          onClick={() => { setTab("password"); setError(""); }}
          className={`flex-1 inline-flex items-center justify-center gap-2 py-2.5 text-xs font-bold uppercase tracking-wider rounded-lg transition-all ${tab === "password" ? "bg-red-600 text-white shadow-[0_0_12px_rgba(220,38,38,0.35)]" : "text-[var(--text-muted)] hover:text-[var(--text-secondary)]"}`}
        >
          <Lock size={12} />
          Email
        </button>
        <button
          type="button"
          onClick={() => { setTab("otp"); setError(""); setOtpStep("enter-mobile"); }}
          className={`flex-1 inline-flex items-center justify-center gap-2 py-2.5 text-xs font-bold uppercase tracking-wider rounded-lg transition-all ${tab === "otp" ? "bg-red-600 text-white shadow-[0_0_12px_rgba(220,38,38,0.35)]" : "text-[var(--text-muted)] hover:text-[var(--text-secondary)]"}`}
        >
          <Smartphone size={12} />
          Mobile OTP
        </button>
      </div>

      {/* Email + Password */}
      {tab === "password" && (
        <form onSubmit={handlePasswordLogin} className="space-y-4">
          <div>
            <label className="text-[var(--text-muted)] text-xs uppercase tracking-wider block mb-2">Email Address</label>
            <div className="relative">
              <Mail size={15} className="absolute left-4 top-1/2 -translate-y-1/2 text-[var(--text-muted)]" />
              <input type="email" required value={email} onChange={(e) => setEmail(e.target.value)} className={inputCls} placeholder="you@company.com" autoComplete="email" />
            </div>
          </div>
          <div>
            <div className="flex items-center justify-between mb-2">
              <label className="text-[var(--text-muted)] text-xs uppercase tracking-wider">Password</label>
              <Link href="/forgot-password" className="text-xs text-red-400 hover:text-red-300 transition-colors">Forgot password?</Link>
            </div>
            <div className="relative">
              <Lock size={15} className="absolute left-4 top-1/2 -translate-y-1/2 text-[var(--text-muted)]" />
              <input type={showPw ? "text" : "password"} required value={password} onChange={(e) => setPassword(e.target.value)} className={inputCls + " pr-12"} placeholder="Your password" autoComplete="current-password" />
              <button type="button" onClick={() => setShowPw(!showPw)} className="absolute right-4 top-1/2 -translate-y-1/2 text-[var(--text-muted)] hover:text-[var(--text-secondary)] transition-colors">
                {showPw ? <EyeOff size={16} /> : <Eye size={16} />}
              </button>
            </div>
          </div>
          {error && (
            <div className="bg-red-900/20 border border-red-900/40 rounded-xl px-4 py-3 text-red-400 text-sm flex items-center gap-2">
              <span className="w-1.5 h-1.5 rounded-full bg-red-500 flex-shrink-0" />
              {error}
            </div>
          )}
          <button type="submit" disabled={status === "loading"} className="w-full inline-flex items-center justify-center gap-2 bg-red-600 hover:bg-red-700 active:bg-red-800 disabled:opacity-50 text-white font-bold py-4 rounded-xl transition-all uppercase tracking-wider text-sm red-glow-sm mt-2">
            {status === "loading" ? <><Spinner size={15} /> Signing in...</> : <>Sign In <ChevronRight size={15} /></>}
          </button>
        </form>
      )}

      {/* Mobile OTP — enter number */}
      {tab === "otp" && otpStep === "enter-mobile" && (
        <form onSubmit={handleSendOTP} className="space-y-4">
          <div>
            <label className="text-[var(--text-muted)] text-xs uppercase tracking-wider block mb-2">Mobile Number</label>
            <div className="flex gap-2">
              <div className="relative flex-shrink-0">
                <Smartphone size={15} className="absolute left-3 top-1/2 -translate-y-1/2 text-[var(--text-muted)]" />
                <span className="themed-input border rounded-xl pl-9 pr-3 py-3 text-sm text-[var(--text-muted)] flex items-center">+91</span>
              </div>
              <input type="tel" required value={mobile} onChange={(e) => setMobile(e.target.value.replace(/\D/g, "").slice(0, 10))} className="flex-1 themed-input border rounded-xl px-4 py-3 text-sm" placeholder="10-digit number" maxLength={10} />
            </div>
          </div>
          {error && (
            <div className="bg-red-900/20 border border-red-900/40 rounded-xl px-4 py-3 text-red-400 text-sm flex items-center gap-2">
              <span className="w-1.5 h-1.5 rounded-full bg-red-500 flex-shrink-0" />
              {error}
            </div>
          )}
          <button type="submit" disabled={status === "loading" || mobile.length !== 10} className="w-full inline-flex items-center justify-center gap-2 bg-red-600 hover:bg-red-700 active:bg-red-800 disabled:opacity-50 text-white font-bold py-4 rounded-xl transition-all uppercase tracking-wider text-sm red-glow-sm mt-2">
            {status === "loading" ? <><Spinner size={15} /> Sending OTP...</> : <>Send OTP <ChevronRight size={15} /></>}
          </button>
        </form>
      )}

      {/* Mobile OTP — enter code */}
      {tab === "otp" && otpStep === "enter-otp" && (
        <form onSubmit={handleOTPLogin} className="space-y-6">
          <div className="bg-[var(--bg-secondary)] border border-[var(--border-color)] rounded-xl px-4 py-3 flex items-center gap-3">
            <Smartphone size={15} className="text-[var(--text-muted)] flex-shrink-0" />
            <p className="text-[var(--text-muted)] text-sm">OTP sent to <span className="text-[var(--text-primary)] font-semibold">+91 {mobile}</span></p>
          </div>
          <OtpInput value={otp} onChange={setOtp} disabled={status === "loading"} />
          {error && (
            <div className="bg-red-900/20 border border-red-900/40 rounded-xl px-4 py-3 text-red-400 text-sm text-center flex items-center justify-center gap-2">
              <span className="w-1.5 h-1.5 rounded-full bg-red-500 flex-shrink-0" />
              {error}
            </div>
          )}
          <button type="submit" disabled={status === "loading" || otp.length !== 6} className="w-full inline-flex items-center justify-center gap-2 bg-red-600 hover:bg-red-700 active:bg-red-800 disabled:opacity-50 text-white font-bold py-4 rounded-xl transition-all uppercase tracking-wider text-sm red-glow-sm">
            {status === "loading" ? <><Spinner size={15} /> Verifying...</> : <>Verify & Sign In <ChevronRight size={15} /></>}
          </button>
          <div className="flex items-center justify-between text-sm">
            <CountdownTimer key={timerKey} seconds={600} onResend={handleResendOTP} label="Resend OTP" />
            <button type="button" onClick={() => { setOtpStep("enter-mobile"); setOtp(""); setError(""); }} className="text-[var(--text-muted)] hover:text-[var(--text-secondary)] transition-colors text-xs">
              Change number
            </button>
          </div>
        </form>
      )}

      <div className="mt-7 pt-6 border-t border-[var(--border-color)] flex items-center justify-between">
        <p className="text-[var(--text-muted)] text-sm">
          Not a dealer?{" "}
          <Link href="/register" className="text-red-400 hover:text-red-300 font-semibold transition-colors">Apply Now</Link>
        </p>
        <Link href="/" className="text-gray-600 hover:text-[var(--text-muted)] text-xs transition-colors">
          &larr; Back to site
        </Link>
      </div>

      <div className="mt-5 grid grid-cols-3 gap-2">
        {[
          { role: "Dealers", desc: "Orders & Invoices" },
          { role: "Vendors", desc: "Purchase Orders" },
          { role: "Admins", desc: "Full Management" },
        ].map((item) => (
          <div key={item.role} className="glass border border-[var(--border-color)] rounded-xl p-3 text-center">
            <div className="text-[var(--text-muted)] text-[10px] font-semibold mb-0.5">{item.role}</div>
            <div className="text-[9px] text-[var(--text-muted)] opacity-70 leading-tight">{item.desc}</div>
          </div>
        ))}
      </div>
    </div>
  );
}

