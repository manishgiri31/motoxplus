"use client";

import { useEffect, useState } from "react";
import { useSearchParams } from "next/navigation";
import { User, Phone, Mail, ChevronRight, ChevronLeft, ShieldCheck } from "lucide-react";
import { OtpInput } from "./otp-input";
import { Spinner } from "@/components/ui/spinner";
import { CountdownTimer } from "./countdown-timer";
import { normalizeIndianMobile } from "@/lib/phone";

type Step = "details" | "otp";

const inputCls = "w-full themed-input border rounded-sm pl-11 pr-4 py-3 text-sm";
const RESEND_COOLDOWN_SECONDS = 45;

// B2C customer signup + login, both in one form (B2C-EXPANSION-PLAN.md
// Phase 2). Unlike LoginForm, there's no separate "does this account exist"
// branch — /api/auth/customer/register is enumeration-safe (same response
// whether the phone is new or already registered) and reuses the existing
// /api/auth/login-otp verify step for both cases, so this form always asks
// for name + phone (+ optional email) up front; a returning customer's name
// is simply ignored server-side. Approval-free — a correct OTP logs straight
// into /account, no pending-approval step.
export function CustomerAuthForm() {
  const searchParams = useSearchParams();
  const callbackUrl = searchParams.get("callbackUrl") || "/account";

  const [step, setStep] = useState<Step>("details");
  const [name, setName] = useState("");
  const [phone, setPhone] = useState("");
  const [email, setEmail] = useState("");
  const [showEmail, setShowEmail] = useState(false);

  const [otp, setOtp] = useState("");
  const [timerKey, setTimerKey] = useState(0);
  const [status, setStatus] = useState<"idle" | "loading" | "error">("idle");
  const [error, setError] = useState("");

  const normalizedPhone = normalizeIndianMobile(phone) || "";

  async function requestOtp(): Promise<boolean> {
    setStatus("loading");
    setError("");
    const res = await fetch("/api/auth/customer/register", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ name: name.trim() || "Customer", phone, email: email.trim() || undefined }),
    });
    const data = await res.json().catch(() => ({}));
    if (!res.ok) {
      setError(data.error || "Couldn't send the code. Please try again.");
      setStatus("error");
      return false;
    }
    setStatus("idle");
    return true;
  }

  async function handleDetailsSubmit(e: React.FormEvent) {
    e.preventDefault();
    if (!normalizedPhone) {
      setError("Enter a valid 10-digit mobile number");
      return;
    }
    if (await requestOtp()) {
      setOtp("");
      setTimerKey((k) => k + 1);
      setError("");
      setStep("otp");
    }
  }

  async function handleResendOtp() {
    const ok = await requestOtp();
    if (!ok) throw new Error(error || "Resend failed");
  }

  async function verifyOtp(code: string) {
    setStatus("loading");
    setError("");
    const res = await fetch("/api/auth/login-otp", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ method: "mobile", mobile: normalizedPhone, otp: code }),
    });
    const data = await res.json().catch(() => ({}));
    if (!res.ok) {
      setError(data.error || "Invalid or expired code");
      setStatus("error");
      setOtp("");
      return;
    }
    window.location.href = callbackUrl;
  }

  useEffect(() => {
    if (otp.length === 6 && status !== "loading") {
      verifyOtp(otp);
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [otp]);

  return (
    <div className="bg-[var(--card)] border border-[var(--line)] p-8">
      <div className="flex items-start justify-between mb-6">
        <div>
          <h1 className="font-display text-2xl font-bold text-[var(--ink)] mb-1">
            {step === "details" ? "Sign in or sign up" : "Enter verification code"}
          </h1>
          <p className="text-[var(--muted)] text-sm">
            {step === "details" ? (
              "New here or coming back — just enter your mobile number."
            ) : (
              <>We&apos;ve sent a 6-digit code via WhatsApp to <span className="text-[var(--ink)] font-semibold">+91 {normalizedPhone}</span></>
            )}
          </p>
        </div>
        <div className="flex items-center gap-1.5 border border-[var(--sig-ok-bd)] bg-[var(--sig-ok-bg)] px-2.5 py-1.5 flex-shrink-0">
          <ShieldCheck size={12} className="text-[var(--sig-ok-fg)]" />
          <span className="text-[10px] text-[var(--sig-ok-fg)] font-semibold tracking-wide">Secure</span>
        </div>
      </div>

      {step === "details" && (
        <form onSubmit={handleDetailsSubmit} className="space-y-4">
          <div>
            <label className="text-[var(--muted)] text-xs uppercase tracking-wider block mb-2">Your Name</label>
            <div className="relative">
              <User size={15} className="absolute left-4 top-1/2 -translate-y-1/2 text-[var(--muted)]" />
              <input
                type="text"
                required
                autoFocus
                value={name}
                onChange={(e) => { setName(e.target.value); setError(""); }}
                className={inputCls}
                placeholder="Rahul Kumar"
              />
            </div>
          </div>
          <div>
            <label className="text-[var(--muted)] text-xs uppercase tracking-wider block mb-2">Mobile Number</label>
            <div className="relative">
              <Phone size={15} className="absolute left-4 top-1/2 -translate-y-1/2 text-[var(--muted)]" />
              <input
                type="tel"
                required
                value={phone}
                onChange={(e) => { setPhone(e.target.value); setError(""); }}
                className={inputCls}
                placeholder="98765 43210"
                autoComplete="tel"
              />
            </div>
          </div>
          {showEmail ? (
            <div>
              <label className="text-[var(--muted)] text-xs uppercase tracking-wider block mb-2">Email (optional)</label>
              <div className="relative">
                <Mail size={15} className="absolute left-4 top-1/2 -translate-y-1/2 text-[var(--muted)]" />
                <input
                  type="email"
                  value={email}
                  onChange={(e) => setEmail(e.target.value)}
                  className={inputCls}
                  placeholder="you@example.com"
                  autoComplete="email"
                />
              </div>
            </div>
          ) : (
            <button type="button" onClick={() => setShowEmail(true)} className="text-xs text-[var(--muted)] hover:text-[var(--ink)] transition-colors">
              + Add email (optional)
            </button>
          )}
          {error && <ErrorBanner message={error} />}
          <button
            type="submit"
            disabled={status === "loading"}
            className="w-full inline-flex items-center justify-center gap-2 bg-[var(--red)] hover:bg-[var(--red-hover)] disabled:opacity-50 text-white font-bold py-4 rounded-sm transition-colors uppercase tracking-wider text-sm mt-2"
          >
            {status === "loading" ? <><Spinner size={15} /> Sending code...</> : <>Continue <ChevronRight size={15} /></>}
          </button>
        </form>
      )}

      {step === "otp" && (
        <div className="space-y-6">
          <OtpInput value={otp} onChange={setOtp} disabled={status === "loading"} />
          <div aria-live="polite">
            {status === "loading" && (
              <p className="text-center text-sm text-[var(--muted)] flex items-center justify-center gap-2">
                <Spinner size={13} /> Verifying...
              </p>
            )}
            {error && <ErrorBanner message={error} center />}
          </div>
          <div className="flex items-center justify-between text-sm">
            <CountdownTimer key={timerKey} seconds={RESEND_COOLDOWN_SECONDS} onResend={handleResendOtp} label="Resend code" compact />
            <button type="button" onClick={() => setStep("details")} className="text-[var(--muted)] hover:text-[var(--ink)] transition-colors text-xs">
              <ChevronLeft size={13} className="inline -mt-0.5" /> Change number
            </button>
          </div>
        </div>
      )}
    </div>
  );
}

function ErrorBanner({ message, center = false }: { message: string; center?: boolean }) {
  return (
    <div className={`bg-[var(--sig-danger-bg)] border border-[var(--sig-danger-bd)] rounded-sm px-4 py-3 text-[var(--sig-danger-fg)] text-sm flex items-center gap-2 ${center ? "justify-center text-center" : ""}`} role="alert">
      <span className="w-1.5 h-1.5 rounded-full bg-[var(--sig-danger-fg)] flex-shrink-0" />
      {message}
    </div>
  );
}
