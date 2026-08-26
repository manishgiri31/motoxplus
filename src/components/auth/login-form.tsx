"use client";

import { useEffect, useState } from "react";
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

const inputCls = "w-full themed-input border rounded-sm pl-11 pr-4 py-3 text-sm";

// How long "Resend code" stays disabled after a send. Deliberately much
// shorter than OTP_EXPIRY_MINUTES (5 min, server-side) — the resend cooldown
// only exists to stop accidental double-sends/spam-clicking, not to mirror
// how long the code itself stays valid. It used to be hardcoded to the same
// 300s as the OTP's validity window, which meant "Resend code" stayed
// disabled for the full 5 minutes even though nothing about abuse
// prevention requires that.
const RESEND_COOLDOWN_SECONDS = 45;

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
  // Set only for a 429/423 password-step response — drives the countdown +
  // "Forgot password?" prompt instead of the plain error banner. Kept
  // separate from `error` so the two states can't fight over which one
  // renders (see handlePasswordLogin).
  const [lockout, setLockout] = useState<{ message: string; retryAfterSeconds: number } | null>(null);

  const masked = kind === "mobile" ? maskMobile(resolvedIdentifier) : maskEmail(resolvedIdentifier);

  function resetTo(next: Step) {
    setStep(next);
    setError("");
    setLockout(null);
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
    setLockout(null);

    // Hits the same REST endpoint the mobile app uses (and that OTP login on
    // this very form already uses — see requestOtp/verifyOtp above) instead
    // of NextAuth's signIn("credentials"). NextAuth's credentials flow always
    // returns HTTP 401 for every authorize() failure — rate-limited, locked,
    // wrong password, disabled, no exceptions — and only ever hands the
    // client a bare error *string*, with no status code or Retry-After
    // header to act on. That's what made a real 429 indistinguishable from
    // a wrong password client-side, and made a countdown impossible: the
    // server computes retryAfterSeconds but NextAuth's transport had nowhere
    // to put it. This endpoint returns real status codes and headers.
    let res: Response;
    try {
      res = await fetch("/api/auth/login", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(kind === "mobile" ? { mobile: resolvedIdentifier, password } : { email: resolvedIdentifier, password }),
      });
    } catch {
      setError("Network error. Check your connection and try again.");
      setStatus("error");
      return;
    }

    let data: { error?: string; retryAfterSeconds?: number } = {};
    try {
      data = await res.json();
    } catch {
      // Non-JSON body (e.g. a proxy/CDN error page in front of the app) —
      // fall through to the generic message below rather than throwing.
    }

    if (!res.ok) {
      if (res.status === 429 || res.status === 423) {
        const headerSeconds = Number(res.headers.get("Retry-After"));
        const retryAfterSeconds = Number.isFinite(headerSeconds) && headerSeconds > 0 ? headerSeconds : (data.retryAfterSeconds ?? 60);
        setLockout({ message: data.error || "Too many attempts.", retryAfterSeconds });
      } else if (res.status === 401 || res.status === 400 || res.status === 403) {
        setError(data.error || "Incorrect email/mobile or password.");
      } else {
        setError("Something went wrong. Please try again.");
      }
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
    <div className="bg-[var(--card)] border border-[var(--line)] p-8">
      <div className="flex items-start justify-between mb-6">
        <div>
          <h1 className="font-display text-2xl font-bold text-[var(--ink)] mb-1">
            {step === "identifier" && "Welcome Back"}
            {step === "method" && "How would you like to sign in?"}
            {step === "password" && "Enter your password"}
            {step === "otp" && "Enter verification code"}
          </h1>
          <p className="text-[var(--muted)] text-sm">
            {step === "identifier" && "Sign in to your MOTOXPLUS account."}
            {step === "method" && <>Signing in as <span className="text-[var(--ink)] font-semibold">{masked}</span></>}
            {step === "password" && <>for <span className="text-[var(--ink)] font-semibold">{masked}</span></>}
            {step === "otp" && (
              <>We&apos;ve sent a 6-digit code to <span className="text-[var(--ink)] font-semibold">{masked}</span></>
            )}
          </p>
        </div>
        <div className="flex items-center gap-1.5 border border-[var(--sig-ok-bd)] bg-[var(--sig-ok-bg)] px-2.5 py-1.5 flex-shrink-0">
          <ShieldCheck size={12} className="text-[var(--sig-ok-fg)]" />
          <span className="text-[10px] text-[var(--sig-ok-fg)] font-semibold tracking-wide">Secure</span>
        </div>
      </div>

      {/* Step 1: identifier */}
      {step === "identifier" && (
        <form onSubmit={handleIdentifierSubmit} className="space-y-4">
          <div>
            <label className="text-[var(--muted)] text-xs uppercase tracking-wider block mb-2">Email or Mobile Number</label>
            <div className="relative">
              <Mail size={15} className="absolute left-4 top-1/2 -translate-y-1/2 text-[var(--muted)]" />
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
          <button type="submit" className="w-full inline-flex items-center justify-center gap-2 bg-[var(--red)] hover:bg-[var(--red-hover)] text-white font-bold py-4 rounded-sm transition-colors uppercase tracking-wider text-sm mt-2">
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
            className="w-full flex items-center gap-3 themed-input border rounded-sm px-4 py-3.5 text-left hover:border-[var(--red)]/50 transition-colors disabled:opacity-50"
          >
            <div className="w-9 h-9 border border-[var(--line)] flex items-center justify-center flex-shrink-0">
              {kind === "mobile" ? <MessageCircle size={16} className="text-[var(--red)]" /> : <Mail size={16} className="text-[var(--red)]" />}
            </div>
            <div className="flex-1">
              <div className="text-sm font-semibold text-[var(--ink)]">
                {kind === "mobile" ? "Send code via WhatsApp" : "Send code to email"}
              </div>
              <div className="text-xs text-[var(--muted)]">No password needed</div>
            </div>
            {status === "loading" ? <Spinner size={15} /> : <ChevronRight size={15} className="text-[var(--muted)]" />}
          </button>

          <button
            type="button"
            onClick={() => resetTo("password")}
            disabled={status === "loading"}
            className="w-full flex items-center gap-3 themed-input border rounded-sm px-4 py-3.5 text-left hover:border-[var(--red)]/50 transition-colors disabled:opacity-50"
          >
            <div className="w-9 h-9 border border-[var(--line)] flex items-center justify-center flex-shrink-0">
              <Lock size={16} className="text-[var(--muted)]" />
            </div>
            <div className="flex-1">
              <div className="text-sm font-semibold text-[var(--ink)]">Use password</div>
            </div>
            <ChevronRight size={15} className="text-[var(--muted)]" />
          </button>

          {error && <ErrorBanner message={error} />}

          <button type="button" onClick={() => resetTo("identifier")} className="w-full flex items-center justify-center gap-1.5 text-[var(--muted)] hover:text-[var(--ink)] transition-colors text-xs pt-1">
            <ChevronLeft size={13} /> Not you? Change
          </button>
        </div>
      )}

      {/* Step 3a: password */}
      {step === "password" && (
        <form onSubmit={handlePasswordLogin} className="space-y-4">
          <div>
            <div className="flex items-center justify-between mb-2">
              <label className="text-[var(--muted)] text-xs uppercase tracking-wider">Password</label>
              <Link href="/forgot-password" className="text-xs text-[var(--red)] hover:text-[var(--red-hover)] transition-colors">Forgot password?</Link>
            </div>
            <div className="relative">
              <Lock size={15} className="absolute left-4 top-1/2 -translate-y-1/2 text-[var(--muted)]" />
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
              <button type="button" onClick={() => setShowPw(!showPw)} className="absolute right-4 top-1/2 -translate-y-1/2 text-[var(--muted)] hover:text-[var(--ink)] transition-colors">
                {showPw ? <EyeOff size={16} /> : <Eye size={16} />}
              </button>
            </div>
          </div>
          {lockout ? (
            <LockoutBanner message={lockout.message} retryAfterSeconds={lockout.retryAfterSeconds} onExpire={() => setLockout(null)} />
          ) : (
            error && <ErrorBanner message={error} />
          )}
          <button type="submit" disabled={status === "loading" || !!lockout} className="w-full inline-flex items-center justify-center gap-2 bg-[var(--red)] hover:bg-[var(--red-hover)] disabled:opacity-50 text-white font-bold py-4 rounded-sm transition-colors uppercase tracking-wider text-sm mt-2">
            {status === "loading" ? <><Spinner size={15} /> Signing in...</> : <>Sign In <ChevronRight size={15} /></>}
          </button>
          <button type="button" onClick={() => resetTo("method")} className="w-full flex items-center justify-center gap-1.5 text-[var(--muted)] hover:text-[var(--ink)] transition-colors text-xs">
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
              <p className="text-center text-sm text-[var(--muted)] flex items-center justify-center gap-2">
                <Spinner size={13} /> Verifying...
              </p>
            )}
            {error && <ErrorBanner message={error} center />}
          </div>
          <div className="flex items-center justify-between text-sm">
            <CountdownTimer key={timerKey} seconds={RESEND_COOLDOWN_SECONDS} onResend={handleResendOtp} label="Resend code" compact />
            <button type="button" onClick={() => resetTo("method")} className="text-[var(--muted)] hover:text-[var(--ink)] transition-colors text-xs">
              Use another method
            </button>
          </div>
        </div>
      )}

      <div className="mt-7 pt-6 border-t border-[var(--line)] flex items-center justify-between">
        <p className="text-[var(--muted)] text-sm">
          Not a dealer?{" "}
          <Link href="/register" className="text-[var(--red)] hover:text-[var(--red-hover)] font-semibold transition-colors">Apply Now</Link>
        </p>
        <Link href="/" className="text-[var(--muted)] hover:text-[var(--ink)] text-xs transition-colors">
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
            <div key={item.role} className="border border-[var(--line)] p-3 text-center">
              <div className="text-[var(--muted)] text-[10px] font-semibold mb-0.5">{item.role}</div>
              <div className="text-[9px] text-[var(--muted)] opacity-70 leading-tight">{item.desc}</div>
            </div>
          ))}
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

// A 429 (rate limited) or 423 (account locked) password-step response gets
// this instead of the plain ErrorBanner: unlike a wrong password, there's a
// real wait time attached, and the account owner's actual way out is usually
// a reset, not more guessing — so both get surfaced instead of leaving the
// user staring at a dead end with no sense of when (or how) to try again.
function LockoutBanner({ message, retryAfterSeconds, onExpire }: { message: string; retryAfterSeconds: number; onExpire: () => void }) {
  return (
    <div className="bg-[var(--sig-danger-bg)] border border-[var(--sig-danger-bd)] rounded-sm px-4 py-3 text-[var(--sig-danger-fg)] text-sm space-y-2" role="alert">
      <div className="flex items-center gap-2">
        <span className="w-1.5 h-1.5 rounded-full bg-[var(--sig-danger-fg)] flex-shrink-0" />
        {message}
      </div>
      <CountdownTimer seconds={retryAfterSeconds} label="Try again" compact onComplete={onExpire} />
      <Link href="/forgot-password" className="inline-block font-semibold underline hover:no-underline">
        Reset your password instead →
      </Link>
    </div>
  );
}
