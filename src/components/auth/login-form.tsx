"use client";

import { useState } from "react";
import { useSearchParams } from "next/navigation";
import Link from "next/link";
import { Button } from "@/components/ui/button";
import { CountdownTimer } from "./countdown-timer";
import { AuthAlert, AuthHeading, PasswordField, TextField } from "./auth-ui";
import { normalizeIndianMobile } from "@/lib/phone";
import { landingPathForRole, safeCallbackTarget } from "@/lib/auth/safe-redirect";

type IdentifierKind = "email" | "mobile";

// Resolves what the user typed into the one identifier box. Returns null for
// anything that is neither an Indian mobile number nor shaped like an email.
function resolveIdentifier(raw: string): { kind: IdentifierKind; value: string } | null {
  const mobile = normalizeIndianMobile(raw);
  if (mobile) return { kind: "mobile", value: mobile };
  const email = raw.trim().toLowerCase();
  return /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email) ? { kind: "email", value: email } : null;
}

// The one sign-in screen for every account type: customers, dealers, vendors
// and staff. Mobile number or email + password, like any other store. One-time
// codes are only ever sent to verify a new account (/signup, /verify-*) and to
// reset a forgotten password (/forgot-password); never to sign in. Where the
// user lands afterwards is decided by their role (landingPathForRole).
export function LoginForm() {
  const searchParams = useSearchParams();
  const callbackParam = searchParams.get("callbackUrl");
  const withCallback = (path: string) => (callbackParam ? `${path}?callbackUrl=${encodeURIComponent(callbackParam)}` : path);

  const [identifierInput, setIdentifierInput] = useState("");
  const [identifierError, setIdentifierError] = useState("");
  const [password, setPassword] = useState("");
  const [passwordError, setPasswordError] = useState("");

  const [status, setStatus] = useState<"idle" | "loading" | "error">("idle");
  const [error, setError] = useState<React.ReactNode>("");
  // Set only for a 429/423 response: drives the countdown + reset prompt
  // instead of the plain error banner.
  const [lockout, setLockout] = useState<{ message: string; retryAfterSeconds: number } | null>(null);

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    if (status === "loading") return;
    const r = resolveIdentifier(identifierInput);
    if (!r) setIdentifierError("Enter a valid email address or 10-digit mobile number");
    if (!password) setPasswordError("Enter your password");
    if (!r || !password) return;

    setStatus("loading");
    setError("");
    setLockout(null);

    // The REST endpoint (not NextAuth's signIn) because it returns real status
    // codes and Retry-After, so a lockout can show a countdown.
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
    const data: { error?: string; code?: string; retryAfterSeconds?: number; user?: { role?: string } } = await res.json().catch(() => ({}));

    if (!res.ok) {
      setStatus("error");
      if (res.status === 429 || res.status === 423) {
        const headerSeconds = Number(res.headers.get("Retry-After"));
        const retryAfterSeconds = Number.isFinite(headerSeconds) && headerSeconds > 0 ? headerSeconds : (data.retryAfterSeconds ?? 60);
        setLockout({ message: data.error || "Too many attempts.", retryAfterSeconds });
        setPassword("");
      } else if (data.code === "NOT_VERIFIED") {
        setError(
          <>
            {data.error}{" "}
            <Link href={withCallback("/signup")} className="font-semibold underline underline-offset-2">Finish signing up</Link>
          </>
        );
      } else if (res.status === 401) {
        // Accounts created before passwords existed for customers (code-only
        // sign-in) have no password yet; Forgot password is how they set one.
        setError(
          <>
            {data.error || "Incorrect email/mobile or password."}
            <span className="mt-1 block text-[13px]">
              Signed up earlier with just a code? <Link href="/forgot-password" className="font-semibold underline underline-offset-2">Set a password</Link>.
            </span>
          </>
        );
      } else if (res.status === 400 || res.status === 403) {
        setError(data.error || "Couldn't sign you in.");
      } else {
        setError("Something went wrong. Please try again.");
      }
      return;
    }

    // Full reload: router.push + refresh race and could bounce back to /login.
    window.location.href = safeCallbackTarget(callbackParam, landingPathForRole(data.user?.role));
  }

  const busy = status === "loading";

  return (
    <div>
      <AuthHeading title="Sign in" subtitle="Use your mobile number or email and your password." />

      <form onSubmit={handleSubmit} className="space-y-5" noValidate>
        <TextField
          label="Mobile number or email"
          type="text"
          autoFocus
          autoCapitalize="none"
          autoCorrect="off"
          spellCheck={false}
          autoComplete="username"
          placeholder="98765 43210 or you@example.com"
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

      <div className="mt-10 space-y-2 border-t border-[var(--line)] pt-6 text-14 text-[var(--muted)]">
        <p>
          New to MOTOXPLUS?{" "}
          <Link href={withCallback("/signup")} className="font-semibold text-[var(--accent-text)] underline-offset-4 hover:underline">
            Create an account
          </Link>
        </p>
        <p>
          Run a parts shop?{" "}
          <Link href="/register" className="font-medium text-[var(--ink)] underline-offset-4 hover:underline">
            Apply for a dealer account
          </Link>
        </p>
      </div>
    </div>
  );
}
