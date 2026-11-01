"use client";

import { useEffect, useState } from "react";
import { useSearchParams } from "next/navigation";
import Link from "next/link";
import { Button } from "@/components/ui/button";
import { CountdownTimer } from "./countdown-timer";
import { AuthOtpStep } from "./auth-otp-step";
import { AuthAlert, AuthHeading, PasswordField, TextField } from "./auth-ui";
import { normalizeIndianMobile } from "@/lib/phone";
import { landingPathForRole, safeCallbackTarget } from "@/lib/auth/safe-redirect";

type Step = "credentials" | "otp";
type IdentifierKind = "email" | "mobile";

function maskEmail(email: string) {
  const [user, domain] = email.split("@");
  if (!domain) return email;
  return `${user.slice(0, 1)}${"*".repeat(Math.max(user.length - 1, 3))}@${domain}`;
}

function maskMobile(mobile: string) {
  return `+91 ••••• ••${mobile.slice(-2)}`;
}

// Resolves what the user typed into the one identifier box. Returns null for
// anything that is neither an Indian mobile number nor shaped like an email.
function resolveIdentifier(raw: string): { kind: IdentifierKind; value: string } | null {
  const mobile = normalizeIndianMobile(raw);
  if (mobile) return { kind: "mobile", value: mobile };
  const email = raw.trim().toLowerCase();
  return /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email) ? { kind: "email", value: email } : null;
}

// Trade sign-in (dealer / vendor / staff). One screen: identifier + password,
// with a one-time code as the alternative. It used to be four steps
// (identifier → "how do you want to sign in?" → password/OTP), which bought no
// security — the server never reveals whether an account exists — and just
// meant password managers couldn't fill the form and every login cost an
// extra tap.
export function LoginForm() {
  const searchParams = useSearchParams();
  const callbackParam = searchParams.get("callbackUrl");

  const [step, setStep] = useState<Step>("credentials");
  const [identifierInput, setIdentifierInput] = useState("");
  const [identifierError, setIdentifierError] = useState("");
  const [resolved, setResolved] = useState<{ kind: IdentifierKind; value: string } | null>(null);
  const [password, setPassword] = useState("");
  const [passwordError, setPasswordError] = useState("");

  const [otp, setOtp] = useState("");
  const [timerKey, setTimerKey] = useState(0);

  const [status, setStatus] = useState<"idle" | "loading" | "error">("idle");
  const [error, setError] = useState("");
  // Set only for a 429/423 password-step response — drives the countdown +
  // "Forgot password?" prompt instead of the plain error banner. Kept separate
  // from `error` so the two can't fight over which one renders.
  const [lockout, setLockout] = useState<{ message: string; retryAfterSeconds: number } | null>(null);

  function goTo(next: Step) {
    setStep(next);
    setError("");
    setLockout(null);
    setStatus("idle");
  }

  // Never trust callbackUrl blindly: it's attacker-controllable (a link in a
  // phishing email can set it), so only same-origin paths are followed. With
  // no (usable) callback the user lands in their own portal by role — the
  // middleware would bounce a wrong guess, but that's a wasted round trip.
  function finish(role: string | undefined) {
    // Full reload instead of router.push+refresh: those race on a slow backend
    // and refresh() can reapply the stale /login segment after push() has
    // navigated, bouncing the user back here with the button stuck on "Signing in...".
    window.location.href = safeCallbackTarget(callbackParam, landingPathForRole(role));
  }

  function resolveOrFlag(): { kind: IdentifierKind; value: string } | null {
    const r = resolveIdentifier(identifierInput);
    if (!r) {
      setIdentifierError("Enter a valid email address or 10-digit mobile number");
      return null;
    }
    setIdentifierError("");
    setResolved(r);
    return r;
  }

  function otpBody(r: { kind: IdentifierKind; value: string }) {
    return r.kind === "mobile" ? { method: "mobile", mobile: r.value } : { method: "email", email: r.value };
  }

  async function requestOtp(r: { kind: IdentifierKind; value: string }): Promise<boolean> {
    setStatus("loading");
    setError("");
    try {
      const res = await fetch("/api/auth/login-otp", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(otpBody(r)),
      });
      const data = await res.json().catch(() => ({}));
      if (!res.ok) {
        setError(data.error || "Couldn't send the code. Please try again.");
        setStatus("error");
        return false;
      }
    } catch {
      setError("Network error. Check your connection and try again.");
      setStatus("error");
      return false;
    }
    setStatus("idle");
    return true;
  }

  async function handleSendCode() {
    const r = resolveOrFlag();
    if (!r) return;
    if (await requestOtp(r)) {
      setOtp("");
      setTimerKey((k) => k + 1);
      goTo("otp");
    }
  }

  async function handleResend() {
    if (!resolved || !(await requestOtp(resolved))) throw new Error("Resend failed");
  }

  async function handlePasswordLogin(e: React.FormEvent) {
    e.preventDefault();
    if (status === "loading") return;
    const r = resolveOrFlag();
    if (!password) setPasswordError("Enter your password");
    if (!r || !password) return;

    setStatus("loading");
    setError("");
    setLockout(null);

    // Hits the same REST endpoint the mobile app uses instead of NextAuth's
    // signIn("credentials"): NextAuth always returns HTTP 401 for every
    // authorize() failure — rate-limited, locked, wrong password, disabled —
    // and hands the client a bare error string with no status or Retry-After,
    // which made a real 429 indistinguishable from a typo and a countdown
    // impossible. This endpoint returns real status codes and headers.
    let res: Response;
    try {
      res = await fetch("/api/auth/login", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(r.kind === "mobile" ? { mobile: r.value, password } : { email: r.value, password }),
      });
    } catch {
      setError("Network error. Check your connection and try again.");
      setStatus("error");
      return;
    }

    let data: { error?: string; retryAfterSeconds?: number; user?: { role?: string } } = {};
    try {
      data = await res.json();
    } catch {
      // Non-JSON body (a proxy/CDN error page in front of the app) — fall
      // through to the generic message below rather than throwing.
    }

    if (!res.ok) {
      if (res.status === 429 || res.status === 423) {
        const headerSeconds = Number(res.headers.get("Retry-After"));
        const retryAfterSeconds = Number.isFinite(headerSeconds) && headerSeconds > 0 ? headerSeconds : (data.retryAfterSeconds ?? 60);
        setLockout({ message: data.error || "Too many attempts.", retryAfterSeconds });
        setPassword("");
      } else if (res.status === 401 || res.status === 400 || res.status === 403) {
        setError(data.error || "Incorrect email/mobile or password.");
      } else {
        setError("Something went wrong. Please try again.");
      }
      setStatus("error");
      return;
    }

    finish(data.user?.role);
  }

  async function verifyOtp(code: string) {
    if (!resolved) return;
    setStatus("loading");
    setError("");
    let res: Response;
    try {
      res = await fetch("/api/auth/login-otp", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ ...otpBody(resolved), otp: code }),
      });
    } catch {
      setError("Network error. Check your connection and try again.");
      setStatus("error");
      setOtp("");
      return;
    }
    const data = await res.json().catch(() => ({}));
    if (!res.ok) {
      setError(data.error || "Invalid or expired code");
      setStatus("error");
      setOtp("");
      return;
    }
    finish(data.user?.role);
  }

  // Auto-submit once all 6 digits are entered — no separate "Verify" tap needed.
  useEffect(() => {
    if (otp.length === 6 && status !== "loading") verifyOtp(otp);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [otp]);

  if (step === "otp" && resolved) {
    return (
      <AuthOtpStep
        destination={resolved.kind === "mobile" ? maskMobile(resolved.value) : maskEmail(resolved.value)}
        channel={resolved.kind === "mobile" ? "WhatsApp" : "email"}
        otp={otp}
        onOtpChange={(v) => { setOtp(v); if (error) setError(""); }}
        status={status}
        error={error}
        timerKey={timerKey}
        onResend={handleResend}
        onBack={() => goTo("credentials")}
        backLabel="Use password instead"
      />
    );
  }

  const busy = status === "loading";
  const codeChannel = resolved?.kind === "mobile" || normalizeIndianMobile(identifierInput) ? "WhatsApp" : "email";

  return (
    <div>
      <AuthHeading title="Sign in" subtitle="For dealers, vendors and MOTOXPLUS staff." />

      <form onSubmit={handlePasswordLogin} className="space-y-5" noValidate>
        <TextField
          label="Email or mobile number"
          type="text"
          autoFocus
          autoCapitalize="none"
          autoCorrect="off"
          spellCheck={false}
          autoComplete="username"
          placeholder="you@company.com or 98765 43210"
          value={identifierInput}
          error={identifierError}
          onChange={(e) => { setIdentifierInput(e.target.value); setIdentifierError(""); setError(""); }}
        />

        <PasswordField
          label="Password"
          value={password}
          error={passwordError}
          autoComplete="current-password"
          labelAction={
            <Link href="/forgot-password" className="text-14 text-[var(--accent-text)] underline-offset-4 hover:underline">
              Forgot password?
            </Link>
          }
          onChange={(e) => { setPassword(e.target.value); setPasswordError(""); if (error) setError(""); }}
        />

        {lockout ? (
          <AuthAlert>
            <p>{lockout.message}</p>
            <div className="mt-1.5">
              <CountdownTimer seconds={lockout.retryAfterSeconds} label="Try again" compact onComplete={() => setLockout(null)} />
            </div>
            <Link href="/forgot-password" className="mt-1.5 inline-block font-medium underline underline-offset-4 hover:no-underline">
              Reset your password instead
            </Link>
          </AuthAlert>
        ) : (
          error && <AuthAlert>{error}</AuthAlert>
        )}

        <Button type="submit" size="lg" block loading={busy} disabled={!!lockout}>
          {busy ? "Signing in..." : "Sign in"}
        </Button>
      </form>

      <div className="my-6 flex items-center gap-4 text-12 uppercase tracking-[0.12em] text-[var(--muted)]" aria-hidden>
        <span className="h-px flex-1 bg-[var(--line)]" /> or <span className="h-px flex-1 bg-[var(--line)]" />
      </div>

      <Button type="button" variant="secondary" size="lg" block onClick={handleSendCode} disabled={busy}>
        Send me a code on {codeChannel}
      </Button>
      <p className="mt-2 text-[13px] text-[var(--muted)]">No password needed. The code works once and expires in 5 minutes.</p>

      <p className="mt-10 border-t border-[var(--line)] pt-6 text-14 text-[var(--muted)]">
        New to MOTOXPLUS?{" "}
        <Link href="/register" className="font-semibold text-[var(--accent-text)] underline-offset-4 hover:underline">
          Apply for a dealer account
        </Link>
      </p>
    </div>
  );
}
