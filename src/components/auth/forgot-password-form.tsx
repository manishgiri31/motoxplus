"use client";

import { useState } from "react";
import Link from "next/link";
import { OtpInput } from "./otp-input";
import { Spinner } from "@/components/ui/spinner";
import { CountdownTimer } from "./countdown-timer";

type Step = "choose-method" | "enter-contact" | "enter-otp" | "new-password" | "success";

export function ForgotPasswordForm() {
  const [step, setStep] = useState<Step>("choose-method");
  const [method, setMethod] = useState<"email" | "mobile">("email");
  const [contact, setContact] = useState("");
  const [userId, setUserId] = useState("");
  const [otp, setOtp] = useState("");
  const [resetToken, setResetToken] = useState("");
  const [newPassword, setNewPassword] = useState("");
  const [confirmPassword, setConfirmPassword] = useState("");
  const [status, setStatus] = useState<"idle" | "loading" | "error">("idle");
  const [error, setError] = useState("");
  const [timerKey, setTimerKey] = useState(0);

  async function handleSendOTP(e: React.FormEvent) {
    e.preventDefault();
    setStatus("loading"); setError("");
    const body = method === "email" ? { email: contact, method: "email" } : { mobile: contact, method: "mobile" };
    const res = await fetch("/api/auth/forgot-password", { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify(body) });
    const data = await res.json();
    if (!res.ok) { setError(data.error || "Failed to send OTP"); setStatus("error"); return; }
    setUserId(data.userId || "");
    setStatus("idle");
    setStep("enter-otp");
    setTimerKey((k) => k + 1);
  }

  async function handleVerifyOTP(e: React.FormEvent) {
    e.preventDefault();
    if (otp.length !== 6) { setError("Enter 6-digit OTP"); return; }
    setStatus("loading"); setError("");
    const res = await fetch("/api/auth/verify-forgot-password-otp", { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ userId, otp }) });
    const data = await res.json();
    if (!res.ok) { setError(data.error || "Invalid OTP"); setStatus("error"); return; }
    setResetToken(data.resetToken);
    setStatus("idle");
    setStep("new-password");
  }

  async function handleReset(e: React.FormEvent) {
    e.preventDefault();
    if (newPassword !== confirmPassword) { setError("Passwords do not match"); return; }
    if (newPassword.length < 8) { setError("Password must be at least 8 characters"); return; }
    setStatus("loading"); setError("");
    const res = await fetch("/api/auth/reset-password", { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ userId, resetToken, newPassword }) });
    const data = await res.json();
    if (!res.ok) { setError(data.error || "Reset failed"); setStatus("error"); return; }
    setStep("success");
  }

  async function handleResend() {
    const body = method === "email" ? { email: contact, method: "email" } : { mobile: contact, method: "mobile" };
    const res = await fetch("/api/auth/forgot-password", { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify(body) });
    if (!res.ok) { const d = await res.json(); throw new Error(d.error || "Resend failed"); }
    setTimerKey((k) => k + 1);
  }

  const inputCls = "w-full themed-input border focus:border-red-600/60 rounded-sm px-4 py-3 text-sm outline-none transition-colors";

  if (step === "success") {
    return (
      <div className="glass border border-[var(--border-color)] rounded-sm p-8 text-center">
        <div className="w-16 h-16 bg-green-900/30 border border-green-700/40 rounded-full flex items-center justify-center mx-auto mb-6">
          <svg className="w-8 h-8 text-green-400" fill="none" viewBox="0 0 24 24" stroke="currentColor">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M5 13l4 4L19 7" />
          </svg>
        </div>
        <h2 className="text-xl font-black text-[var(--text-primary)] mb-2">Password Reset!</h2>
        <p className="text-[var(--text-muted)] text-sm mb-6">Your password has been reset successfully. You can now log in with your new password.</p>
        <Link href="/login" className="inline-block bg-red-600 hover:bg-red-700 text-white font-bold py-3 px-8 rounded-sm transition-colors uppercase tracking-wider text-sm">
          Go to Login
        </Link>
      </div>
    );
  }

  return (
    <div className="glass border border-[var(--border-color)] rounded-sm p-8">
      <h1 className="text-xl font-black text-[var(--text-primary)] mb-2">Forgot Password</h1>

      {step === "choose-method" && (
        <div className="space-y-4">
          <p className="text-[var(--text-muted)] text-sm mb-6">How would you like to reset your password?</p>
          <button onClick={() => { setMethod("email"); setStep("enter-contact"); }} className="w-full flex items-center gap-4 border border-[var(--border-color)] hover:border-red-600/40 rounded-sm p-4 transition-colors text-left group">
            <div className="w-10 h-10 bg-red-900/20 rounded-sm flex items-center justify-center flex-shrink-0 group-hover:bg-red-900/30">
              <svg className="w-5 h-5 text-red-400" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M3 8l7.89 5.26a2 2 0 002.22 0L21 8M5 19h14a2 2 0 002-2V7a2 2 0 00-2-2H5a2 2 0 00-2 2v10a2 2 0 002 2z" /></svg>
            </div>
            <div>
              <div className="text-[var(--text-primary)] font-bold text-sm">Via Email OTP</div>
              <div className="text-[var(--text-muted)] text-xs">Receive OTP on your registered email</div>
            </div>
          </button>
          <button onClick={() => { setMethod("mobile"); setStep("enter-contact"); }} className="w-full flex items-center gap-4 border border-[var(--border-color)] hover:border-red-600/40 rounded-sm p-4 transition-colors text-left group">
            <div className="w-10 h-10 bg-red-900/20 rounded-sm flex items-center justify-center flex-shrink-0 group-hover:bg-red-900/30">
              <svg className="w-5 h-5 text-red-400" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M12 18h.01M8 21h8a2 2 0 002-2V5a2 2 0 00-2-2H8a2 2 0 00-2 2v14a2 2 0 002 2z" /></svg>
            </div>
            <div>
              <div className="text-[var(--text-primary)] font-bold text-sm">Via Mobile OTP</div>
              <div className="text-[var(--text-muted)] text-xs">Receive OTP on your registered mobile</div>
            </div>
          </button>
          <div className="pt-2 text-center">
            <Link href="/login" className="text-[var(--text-muted)] text-sm hover:text-[var(--text-secondary)]">Back to Login</Link>
          </div>
        </div>
      )}

      {step === "enter-contact" && (
        <form onSubmit={handleSendOTP} className="space-y-4">
          <p className="text-[var(--text-muted)] text-sm mb-6">Enter your {method === "email" ? "email address" : "mobile number"}.</p>
          <div>
            <label className="text-[var(--text-muted)] text-xs uppercase tracking-wider block mb-2">{method === "email" ? "Email Address" : "Mobile Number"}</label>
            {method === "mobile" ? (
              <div className="flex gap-2">
                <span className="themed-input border rounded-sm px-3 py-3 text-sm text-[var(--text-muted)] whitespace-nowrap">+91</span>
                <input type="tel" required value={contact} onChange={(e) => setContact(e.target.value.replace(/\D/g, "").slice(0, 10))} className={inputCls} placeholder="10-digit number" maxLength={10} />
              </div>
            ) : (
              <input type="email" required value={contact} onChange={(e) => setContact(e.target.value)} className={inputCls} placeholder="you@company.com" />
            )}
          </div>
          {error && <div className="bg-red-900/20 border border-red-900/40 rounded-sm px-4 py-3 text-red-400 text-sm">{error}</div>}
          <button type="submit" disabled={status === "loading"} className="w-full inline-flex items-center justify-center gap-2 bg-red-600 hover:bg-red-700 disabled:opacity-50 text-white font-bold py-4 rounded-sm transition-colors uppercase tracking-wider text-sm">
            {status === "loading" ? <><Spinner size={15} /> Sending OTP...</> : "Send OTP"}
          </button>
          <button type="button" onClick={() => setStep("choose-method")} className="w-full text-center text-sm text-[var(--text-muted)] hover:text-[var(--text-secondary)]">Change method</button>
        </form>
      )}

      {step === "enter-otp" && (
        <form onSubmit={handleVerifyOTP} className="space-y-6">
          <p className="text-[var(--text-muted)] text-sm mb-2">Enter the 6-digit OTP sent to <span className="text-white">{method === "email" ? contact : `+91 ${contact}`}</span>.</p>
          <OtpInput value={otp} onChange={setOtp} disabled={status === "loading"} />
          {error && <div className="bg-red-900/20 border border-red-900/40 rounded-sm px-4 py-3 text-red-400 text-sm text-center">{error}</div>}
          <button type="submit" disabled={status === "loading" || otp.length !== 6} className="w-full inline-flex items-center justify-center gap-2 bg-red-600 hover:bg-red-700 disabled:opacity-50 text-white font-bold py-4 rounded-sm transition-colors uppercase tracking-wider text-sm">
            {status === "loading" ? <><Spinner size={15} /> Verifying...</> : "Verify OTP"}
          </button>
          <CountdownTimer key={timerKey} seconds={600} onResend={handleResend} label="Resend OTP" />
        </form>
      )}

      {step === "new-password" && (
        <form onSubmit={handleReset} className="space-y-4">
          <p className="text-[var(--text-muted)] text-sm mb-6">Create your new password.</p>
          <div>
            <label className="text-[var(--text-muted)] text-xs uppercase tracking-wider block mb-2">New Password</label>
            <input type="password" required minLength={8} value={newPassword} onChange={(e) => setNewPassword(e.target.value)} className={inputCls} placeholder="Min. 8 characters" />
          </div>
          <div>
            <label className="text-[var(--text-muted)] text-xs uppercase tracking-wider block mb-2">Confirm New Password</label>
            <input type="password" required value={confirmPassword} onChange={(e) => setConfirmPassword(e.target.value)} className={inputCls} placeholder="Repeat password" />
          </div>
          {error && <div className="bg-red-900/20 border border-red-900/40 rounded-sm px-4 py-3 text-red-400 text-sm">{error}</div>}
          <button type="submit" disabled={status === "loading"} className="w-full inline-flex items-center justify-center gap-2 bg-red-600 hover:bg-red-700 disabled:opacity-50 text-white font-bold py-4 rounded-sm transition-colors uppercase tracking-wider text-sm">
            {status === "loading" ? <><Spinner size={15} /> Resetting...</> : "Reset Password"}
          </button>
        </form>
      )}
    </div>
  );
}

