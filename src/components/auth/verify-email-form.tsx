"use client";

import { useState, useEffect } from "react";
import { useSearchParams } from "next/navigation";
import Link from "next/link";
import { OtpInput } from "./otp-input";
import { Spinner } from "@/components/ui/spinner";
import { CountdownTimer } from "./countdown-timer";

export function VerifyEmailForm() {
  const params = useSearchParams();
  const userId = params.get("userId") || "";
  const [otp, setOtp] = useState("");
  const [status, setStatus] = useState<"idle" | "loading" | "success" | "error">("idle");
  const [error, setError] = useState("");
  const [timerKey, setTimerKey] = useState(0);

  async function handleVerify(e: React.FormEvent) {
    e.preventDefault();
    if (otp.length !== 6) { setError("Enter the 6-digit OTP"); return; }
    setStatus("loading"); setError("");
    const res = await fetch("/api/auth/verify-email", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ userId, otp }),
    });
    const data = await res.json();
    if (!res.ok) { setError(data.error || "Verification failed"); setStatus("error"); return; }
    setStatus("success");
  }

  async function handleResend() {
    const res = await fetch("/api/auth/send-email-verification", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ userId }),
    });
    const data = await res.json();
    if (!res.ok) throw new Error(data.error || "Failed to resend");
    setTimerKey((k) => k + 1);
  }

  if (status === "success") {
    return (
      <div className="glass border border-[var(--border-color)] rounded-sm p-8 text-center">
        <div className="w-16 h-16 bg-green-900/30 border border-green-700/40 rounded-full flex items-center justify-center mx-auto mb-6">
          <svg className="w-8 h-8 text-green-400" fill="none" viewBox="0 0 24 24" stroke="currentColor">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M5 13l4 4L19 7" />
          </svg>
        </div>
        <h2 className="text-xl font-black text-[var(--text-primary)] mb-2">Email Verified!</h2>
        <p className="text-[var(--text-muted)] text-sm mb-6">Your email has been verified. Your dealer application is now under review.</p>
        <Link href="/login" className="inline-block bg-red-600 hover:bg-red-700 text-white font-bold py-3 px-8 rounded-sm transition-colors uppercase tracking-wider text-sm">
          Go to Login
        </Link>
      </div>
    );
  }

  return (
    <div className="glass border border-[var(--border-color)] rounded-sm p-8">
      <div className="text-center mb-8">
        <div className="w-14 h-14 bg-red-900/20 border border-red-900/40 rounded-full flex items-center justify-center mx-auto mb-4">
          <svg className="w-7 h-7 text-red-400" fill="none" viewBox="0 0 24 24" stroke="currentColor">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M3 8l7.89 5.26a2 2 0 002.22 0L21 8M5 19h14a2 2 0 002-2V7a2 2 0 00-2-2H5a2 2 0 00-2 2v10a2 2 0 002 2z" />
          </svg>
        </div>
        <h1 className="text-xl font-black text-[var(--text-primary)] mb-2">Verify Email Address</h1>
        <p className="text-[var(--text-muted)] text-sm">Enter the 6-digit OTP sent to your email address.</p>
      </div>

      <form onSubmit={handleVerify} className="space-y-6">
        <OtpInput value={otp} onChange={setOtp} disabled={status === "loading"} />

        {error && <div className="bg-red-900/20 border border-red-900/40 rounded-sm px-4 py-3 text-red-400 text-sm text-center">{error}</div>}

        <button type="submit" disabled={status === "loading" || otp.length !== 6} className="w-full inline-flex items-center justify-center gap-2 bg-red-600 hover:bg-red-700 disabled:opacity-50 text-white font-bold py-4 rounded-sm transition-colors uppercase tracking-wider text-sm">
          {status === "loading" ? <><Spinner size={15} /> Verifying...</> : "Verify Email"}
        </button>

        <CountdownTimer key={timerKey} seconds={600} onResend={handleResend} label="Resend Verification Email" />
      </form>

      <div className="mt-6 pt-6 border-t border-[var(--border-color)] text-center">
        <Link href="/login" className="text-[var(--text-muted)] text-sm hover:text-[var(--text-secondary)]">← Back to Login</Link>
      </div>
    </div>
  );
}

