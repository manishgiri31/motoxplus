"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { OtpInput } from "./otp-input";
import { Spinner } from "@/components/ui/spinner";
import { CountdownTimer } from "./countdown-timer";

export function VerifyMobileForm() {
  const router = useRouter();
  const [mobile, setMobile] = useState("");
  const [otp, setOtp] = useState("");
  const [step, setStep] = useState<"enter-mobile" | "enter-otp" | "success">("enter-mobile");
  const [status, setStatus] = useState<"idle" | "loading" | "error">("idle");
  const [error, setError] = useState("");
  const [timerKey, setTimerKey] = useState(0);

  async function handleSendOTP(e: React.FormEvent) {
    e.preventDefault();
    setStatus("loading"); setError("");
    const res = await fetch("/api/auth/send-mobile-otp", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ mobile }),
    });
    const data = await res.json();
    if (!res.ok) { setError(data.error || "Failed to send OTP"); setStatus("error"); return; }
    setStatus("idle");
    setStep("enter-otp");
    setTimerKey((k) => k + 1);
  }

  async function handleVerify(e: React.FormEvent) {
    e.preventDefault();
    if (otp.length !== 6) { setError("Enter the 6-digit OTP"); return; }
    setStatus("loading"); setError("");
    const res = await fetch("/api/auth/verify-mobile", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ otp }),
    });
    const data = await res.json();
    if (!res.ok) { setError(data.error || "Verification failed"); setStatus("error"); return; }
    setStep("success");
  }

  async function handleResend() {
    const res = await fetch("/api/auth/send-mobile-otp", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ mobile }),
    });
    const data = await res.json();
    if (!res.ok) throw new Error(data.error || "Failed to resend");
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
        <h2 className="text-xl font-black text-[var(--text-primary)] mb-2">Mobile Verified!</h2>
        <p className="text-[var(--text-muted)] text-sm mb-6">Your mobile number has been verified successfully.</p>
        <button onClick={() => router.back()} className="bg-red-600 hover:bg-red-700 text-white font-bold py-3 px-8 rounded-sm transition-colors uppercase tracking-wider text-sm">
          Continue
        </button>
      </div>
    );
  }

  return (
    <div className="glass border border-[var(--border-color)] rounded-sm p-8">
      <div className="text-center mb-8">
        <h1 className="text-xl font-black text-[var(--text-primary)] mb-2">Verify Mobile Number</h1>
        <p className="text-[var(--text-muted)] text-sm">
          {step === "enter-mobile" ? "Enter your mobile number to receive an OTP." : `OTP sent to +91 ${mobile}`}
        </p>
      </div>

      {step === "enter-mobile" && (
        <form onSubmit={handleSendOTP} className="space-y-4">
          <div>
            <label className="text-[var(--text-muted)] text-xs uppercase tracking-wider block mb-2">Mobile Number</label>
            <div className="flex gap-2">
              <span className="themed-input border rounded-sm px-3 py-3 text-sm text-[var(--text-muted)] whitespace-nowrap">+91</span>
              <input type="tel" required value={mobile} onChange={(e) => setMobile(e.target.value.replace(/\D/g, "").slice(0, 10))} className={inputCls} placeholder="10-digit mobile number" maxLength={10} />
            </div>
          </div>
          {error && <div className="bg-red-900/20 border border-red-900/40 rounded-sm px-4 py-3 text-red-400 text-sm">{error}</div>}
          <button type="submit" disabled={status === "loading" || mobile.length !== 10} className="w-full inline-flex items-center justify-center gap-2 bg-red-600 hover:bg-red-700 disabled:opacity-50 text-white font-bold py-4 rounded-sm transition-colors uppercase tracking-wider text-sm">
            {status === "loading" ? <><Spinner size={15} /> Sending OTP...</> : "Send OTP"}
          </button>
        </form>
      )}

      {step === "enter-otp" && (
        <form onSubmit={handleVerify} className="space-y-6">
          <OtpInput value={otp} onChange={setOtp} disabled={status === "loading"} />
          {error && <div className="bg-red-900/20 border border-red-900/40 rounded-sm px-4 py-3 text-red-400 text-sm text-center">{error}</div>}
          <button type="submit" disabled={status === "loading" || otp.length !== 6} className="w-full inline-flex items-center justify-center gap-2 bg-red-600 hover:bg-red-700 disabled:opacity-50 text-white font-bold py-4 rounded-sm transition-colors uppercase tracking-wider text-sm">
            {status === "loading" ? <><Spinner size={15} /> Verifying...</> : "Verify OTP"}
          </button>
          <CountdownTimer key={timerKey} seconds={600} onResend={handleResend} label="Resend OTP" />
          <button type="button" onClick={() => setStep("enter-mobile")} className="w-full text-center text-sm text-[var(--text-muted)] hover:text-[var(--text-secondary)]">
            Change mobile number
          </button>
        </form>
      )}
    </div>
  );
}

