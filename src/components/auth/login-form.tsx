"use client";

import { useEffect, useState } from "react";
import { signIn } from "next-auth/react";
import { useSearchParams } from "next/navigation";
import Link from "next/link";
import { Eye, EyeOff, Mail, Lock, MessageCircle, ShieldCheck, ChevronRight, ChevronLeft } from "lucide-react";
import { OtpInput } from "./otp-input";
import { Spinner } from "@/components/ui/spinner";
import { CountdownTimer } from "./countdown-timer";
import { normalizeIndianMobile } from "@/lib/phone";

type Step = "identifier" | "method" | "password" | "otp";
type IdentifierKind = "email" | "mobile";

function maskEmail(email: string) {
  const [user, domain] = email.split("@");
  if (!domain) return email;
  return `${user.slice(0, 1)}${"*".repeat(Math.max(user.length - 1, 3))}@${domain}`;
}

function maskMobile(mobile: string) {
  return `+91 ••••• ••${mobile.slice(-2)}`;
}

const inputCls = "w-full themed-input border rounded-xl pl-11 pr-4 py-3 text-sm";

export function LoginForm() {
  const searchParams = useSearchParams();
  const callbackUrl = searchParams.get("callbackUrl") || "/dealer/dashboard";

  const [step, setStep] = useState<Step>("identifier");

  const [identifierInput, setIdentifierInput] = useState("");
  const [kind, setKind] = useState<IdentifierKind>("email");
  const [resolvedIdentifier, setResolvedIdentifier] = useState(""); // normalized email or bare 10-digit mobile

  const [password, setPassword] = useState("");
  const [showPw, setShowPw] = useState(false);

  const [otp, setOtp] = useState("");
  const [timerKey, setTimerKey] = useState(0);

  const [status, setStatus] = useState<"idle" | "loading" | "error">("idle");
  const [error, setError] = useState("");

  const masked = kind === "mobile" ? maskMobile(resolvedIdentifier) : maskEmail(resolvedIdentifier);

  function resetTo(next: Step) {
    setStep(next);
    setError("");
    setStatus("idle");
  }

  function handleIdentifierSubmit(e: React.FormEvent) {
    e.preventDefault();
    const mobile = normalizeIndianMobile(identifierInput);
    if (mobile) {
      setKind("mobile");
      setResolvedIdentifier(mobile);
    } else {
      const email = identifierInput.trim().toLowerCase();
      if (!email.includes("@")) {
        setError("Enter a valid email address or 10-digit mobile number");
        return;
      }
      setKind("email");
      setResolvedIdentifier(email);
    }
    resetTo("method");
  }

  function otpRequestBody() {
    return kind === "mobile" ? { method: "mobile", mobile: resolvedIdentifier } : { method: "email", email: resolvedIdentifier };
  }

  async function requestOtp() {
    setStatus("loading");
    setError("");
    const res = await fetch("/api/auth/login-otp", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(otpRequestBody()),
    });
    const data = await res.json();
    if (!res.ok) {
      setError(data.error || "Couldn't send the code. Please try again.");
      setStatus("error");
      return false;
    }
    setStatus("idle");
    return true;
  }

  async function handleSendOtp(e: React.FormEvent) {
    e.preventDefault();
    if (await requestOtp()) {
      setOtp("");
      setTimerKey((k) => k + 1);
      resetTo("otp");
    }
  }

  async function handleResendOtp() {
    const ok = await requestOtp();
    if (!ok) throw new Error(error || "Resend failed");
  }

  async function handlePasswordLogin(e: React.FormEvent) {
    e.preventDefault();
    setStatus("loading");
    setError("");
    const result = await signIn("credentials", { identifier: resolvedIdentifier, password, redirect: false });
    if (result?.error) {
      setError(result.error);
      setStatus("error");
      return;
    }
    // Full reload instead of router.push+refresh: those race against each
    // other on a slow backend, and refresh() can reapply the stale /login
    // segment after push() has already navigated, bouncing the user back
    // here with the submit button frozen on "Signing in...".
    window.location.href = callbackUrl;
  }

  async function verifyOtp(code: string) {
    setStatus("loading");
    setError("");
    const res = await fetch("/api/auth/login-otp", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ ...otpRequestBody(), otp: code }),
    });
    const data = await res.json();
    if (!res.ok) {
      setError(data.error || "Invalid or expired code");
      setStatus("error");
      setOtp("");
      return;
    }
    window.location.href = callbackUrl;
  }

  // Auto-submit once all 6 digits are entered — no separate "Verify" tap needed.
  useEffect(() => {
    if (otp.length === 6 && status !== "loading") {
      verifyOtp(otp);
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [otp]);

  return (
    <div className="glass border border-[var(--border-color)] rounded-2xl p-8">
      <div className="flex items-start justify-between mb-6">
        <div>
          <h1 className="text-2xl font-black text-[var(--text-primary)] mb-1">
            {step === "identifier" && "Welcome Back"}
            {step === "method" && "How would you like to sign in?"}
            {step === "password" && "Enter your password"}
            {step === "otp" && "Enter verification code"}
          </h1>
          <p className="text-[var(--text-muted)] text-sm">
            {step === "identifier" && "Sign in to your MOTOXPLUS account."}
            {step === "method" && <>Signing in as <span className="text-[var(--text-primary)] font-semibold">{masked}</span></>}
            {step === "password" && <>for <span className="text-[var(--text-primary)] font-semibold">{masked}</span></>}
            {step === "otp" && (
              <>We&apos;ve sent a 6-digit code to <span className="text-[var(--text-primary)] font-semibold">{masked}</span></>
            )}
          </p>
        </div>
        <div className="flex items-center gap-1.5 bg-green-900/20 border border-green-800/30 rounded-lg px-2.5 py-1.5 flex-shrink-0">
          <ShieldCheck size={12} className="text-green-400" />
          <span className="text-[10px] text-green-400 font-semibold tracking-wide">Secure</span>
        </div>
      </div>

      {/* Step 1: identifier */}
      {step === "identifier" && (
        <form onSubmit={handleIdentifierSubmit} className="space-y-4">
          <div>
            <label className="text-[var(--text-muted)] text-xs uppercase tracking-wider block mb-2">Email or Mobile Number</label>
            <div className="relative">
              <Mail size={15} className="absolute left-4 top-1/2 -translate-y-1/2 text-[var(--text-muted)]" />
              <input
                type="text"
                required
                autoFocus
                value={identifierInput}
                onChange={(e) => { setIdentifierInput(e.target.value); setError(""); }}
                className={inputCls}
                placeholder="you@company.com or 98765 43210"
                autoComplete="username"
              />
            </div>
          </div>
          {error && <ErrorBanner message={error} />}
          <button type="submit" className="w-full inline-flex items-center justify-center gap-2 bg-red-600 hover:bg-red-700 active:bg-red-800 text-white font-bold py-4 rounded-xl transition-all uppercase tracking-wider text-sm red-glow-sm mt-2">
            Continue <ChevronRight size={15} />
          </button>
        </form>
      )}

      {/* Step 2: choose method — options depend on whether the identifier resolved to email or mobile */}
      {step === "method" && (
        <div className="space-y-3">
          <button
            type="button"
            onClick={handleSendOtp}
            disabled={status === "loading"}
            className="w-full flex items-center gap-3 themed-input border rounded-xl px-4 py-3.5 text-left hover:border-red-600/50 transition-colors disabled:opacity-50"
          >
            <div className="w-9 h-9 rounded-lg bg-red-900/20 border border-red-800/30 flex items-center justify-center flex-shrink-0">
              {kind === "mobile" ? <MessageCircle size={16} className="text-red-400" /> : <Mail size={16} className="text-red-400" />}
            </div>
            <div className="flex-1">
              <div className="text-sm font-semibold text-[var(--text-primary)]">
                {kind === "mobile" ? "Send code via WhatsApp" : "Send code to email"}
              </div>
              <div className="text-xs text-[var(--text-muted)]">No password needed</div>
            </div>
            {status === "loading" ? <Spinner size={15} /> : <ChevronRight size={15} className="text-[var(--text-muted)]" />}
          </button>

          <button
            type="button"
            onClick={() => resetTo("password")}
            disabled={status === "loading"}
            className="w-full flex items-center gap-3 themed-input border rounded-xl px-4 py-3.5 text-left hover:border-red-600/50 transition-colors disabled:opacity-50"
          >
            <div className="w-9 h-9 rounded-lg bg-[var(--bg-secondary)] border border-[var(--border-color)] flex items-center justify-center flex-shrink-0">
              <Lock size={16} className="text-[var(--text-muted)]" />
            </div>
            <div className="flex-1">
              <div className="text-sm font-semibold text-[var(--text-primary)]">Use password</div>
            </div>
            <ChevronRight size={15} className="text-[var(--text-muted)]" />
          </button>

          {error && <ErrorBanner message={error} />}

          <button type="button" onClick={() => resetTo("identifier")} className="w-full flex items-center justify-center gap-1.5 text-[var(--text-muted)] hover:text-[var(--text-secondary)] transition-colors text-xs pt-1">
            <ChevronLeft size={13} /> Not you? Change
          </button>
        </div>
      )}

      {/* Step 3a: password */}
      {step === "password" && (
        <form onSubmit={handlePasswordLogin} className="space-y-4">
          <div>
            <div className="flex items-center justify-between mb-2">
              <label className="text-[var(--text-muted)] text-xs uppercase tracking-wider">Password</label>
              <Link href="/forgot-password" className="text-xs text-red-400 hover:text-red-300 transition-colors">Forgot password?</Link>
            </div>
            <div className="relative">
              <Lock size={15} className="absolute left-4 top-1/2 -translate-y-1/2 text-[var(--text-muted)]" />
              <input
                type={showPw ? "text" : "password"}
                required
                autoFocus
                value={password}
                onChange={(e) => setPassword(e.target.value)}
                className={inputCls + " pr-12"}
                placeholder="Your password"
                autoComplete="current-password"
              />
              <button type="button" onClick={() => setShowPw(!showPw)} className="absolute right-4 top-1/2 -translate-y-1/2 text-[var(--text-muted)] hover:text-[var(--text-secondary)] transition-colors">
                {showPw ? <EyeOff size={16} /> : <Eye size={16} />}
              </button>
            </div>
          </div>
          {error && <ErrorBanner message={error} />}
          <button type="submit" disabled={status === "loading"} className="w-full inline-flex items-center justify-center gap-2 bg-red-600 hover:bg-red-700 active:bg-red-800 disabled:opacity-50 text-white font-bold py-4 rounded-xl transition-all uppercase tracking-wider text-sm red-glow-sm mt-2">
            {status === "loading" ? <><Spinner size={15} /> Signing in...</> : <>Sign In <ChevronRight size={15} /></>}
          </button>
          <button type="button" onClick={() => resetTo("method")} className="w-full flex items-center justify-center gap-1.5 text-[var(--text-muted)] hover:text-[var(--text-secondary)] transition-colors text-xs">
            <ChevronLeft size={13} /> Use another method
          </button>
        </form>
      )}

      {/* Step 3b: OTP */}
      {step === "otp" && (
        <div className="space-y-6">
          <OtpInput value={otp} onChange={setOtp} disabled={status === "loading"} />
          <div aria-live="polite">
            {status === "loading" && (
              <p className="text-center text-sm text-[var(--text-muted)] flex items-center justify-center gap-2">
                <Spinner size={13} /> Verifying...
              </p>
            )}
            {error && <ErrorBanner message={error} center />}
          </div>
          <div className="flex items-center justify-between text-sm">
            <CountdownTimer key={timerKey} seconds={300} onResend={handleResendOtp} label="Resend code" compact />
            <button type="button" onClick={() => resetTo("method")} className="text-[var(--text-muted)] hover:text-[var(--text-secondary)] transition-colors text-xs">
              Use another method
            </button>
          </div>
        </div>
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

      {step === "identifier" && (
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
      )}
    </div>
  );
}

function ErrorBanner({ message, center = false }: { message: string; center?: boolean }) {
  return (
    <div className={`bg-red-900/20 border border-red-900/40 rounded-xl px-4 py-3 text-red-400 text-sm flex items-center gap-2 ${center ? "justify-center text-center" : ""}`} role="alert">
      <span className="w-1.5 h-1.5 rounded-full bg-red-500 flex-shrink-0" />
      {message}
    </div>
  );
}
