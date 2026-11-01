"use client";

import { useEffect, useState } from "react";
import { useSearchParams } from "next/navigation";
import Link from "next/link";
import { Button } from "@/components/ui/button";
import { AuthOtpStep } from "./auth-otp-step";
import { AuthAlert, AuthHeading, TextAction, TextField } from "./auth-ui";
import { normalizeIndianMobile } from "@/lib/phone";
import { landingPathForRole, safeCallbackTarget } from "@/lib/auth/safe-redirect";

type Step = "details" | "otp";

// B2C customer signup + login, both in one form (B2C-EXPANSION-PLAN.md
// Phase 2). Unlike the trade login, there's no separate "does this account
// exist" branch — /api/auth/customer/register is enumeration-safe (same
// response whether the phone is new or already registered) and reuses the
// existing /api/auth/login-otp verify step for both cases, so this form always
// asks for the mobile number up front; a returning customer's name is simply
// ignored server-side (which is why the name field is optional here). The
// mobile number is only ever *proved* by the WhatsApp code — approval-free, a
// correct OTP logs straight into /account.
export function CustomerAuthForm() {
  const searchParams = useSearchParams();
  const callbackParam = searchParams.get("callbackUrl");

  const [step, setStep] = useState<Step>("details");
  const [name, setName] = useState("");
  const [phone, setPhone] = useState("");
  const [email, setEmail] = useState("");
  const [showEmail, setShowEmail] = useState(false);
  const [phoneError, setPhoneError] = useState("");

  const [otp, setOtp] = useState("");
  const [timerKey, setTimerKey] = useState(0);
  const [status, setStatus] = useState<"idle" | "loading" | "error">("idle");
  const [error, setError] = useState("");

  const normalizedPhone = normalizeIndianMobile(phone) || "";

  async function requestOtp(): Promise<boolean> {
    setStatus("loading");
    setError("");
    try {
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
    } catch {
      setError("Network error. Check your connection and try again.");
      setStatus("error");
      return false;
    }
    setStatus("idle");
    return true;
  }

  async function handleDetailsSubmit(e: React.FormEvent) {
    e.preventDefault();
    if (status === "loading") return;
    if (!normalizedPhone) {
      setPhoneError("Enter a valid 10-digit mobile number");
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
    if (!(await requestOtp())) throw new Error("Resend failed");
  }

  async function verifyOtp(code: string) {
    setStatus("loading");
    setError("");
    let res: Response;
    try {
      res = await fetch("/api/auth/login-otp", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ method: "mobile", mobile: normalizedPhone, otp: code }),
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
    // Same-origin paths only (see safe-redirect.ts); a dealer who typed their
    // own number here lands in the dealer portal, not /account.
    window.location.href = safeCallbackTarget(callbackParam, landingPathForRole(data.user?.role));
  }

  useEffect(() => {
    if (otp.length === 6 && status !== "loading") verifyOtp(otp);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [otp]);

  if (step === "otp") {
    return (
      <AuthOtpStep
        destination={`+91 ••••• ••${normalizedPhone.slice(-2)}`}
        channel="WhatsApp"
        otp={otp}
        onOtpChange={(v) => { setOtp(v); if (error) setError(""); }}
        status={status}
        error={error}
        timerKey={timerKey}
        onResend={handleResendOtp}
        onBack={() => { setStep("details"); setError(""); setStatus("idle"); }}
        backLabel="Change number"
      />
    );
  }

  return (
    <div>
      <AuthHeading title="Sign in or sign up" subtitle="Enter your mobile number. We'll send a one-time code on WhatsApp. No password to remember." />

      <form onSubmit={handleDetailsSubmit} className="space-y-5" noValidate>
        <TextField
          label="Mobile number"
          type="tel"
          inputMode="numeric"
          prefix="+91"
          autoFocus
          autoComplete="tel-national"
          placeholder="98765 43210"
          value={phone}
          error={phoneError}
          onChange={(e) => { setPhone(e.target.value); setPhoneError(""); setError(""); }}
        />
        <TextField
          label="Your name"
          type="text"
          autoComplete="name"
          placeholder="Rahul Kumar"
          hint="First time here? Add your name. Returning customers can skip this."
          maxLength={100}
          value={name}
          onChange={(e) => setName(e.target.value)}
        />
        {showEmail ? (
          <TextField
            label="Email (optional)"
            type="email"
            autoComplete="email"
            autoCapitalize="none"
            placeholder="you@example.com"
            value={email}
            onChange={(e) => setEmail(e.target.value)}
          />
        ) : (
          <TextAction onClick={() => setShowEmail(true)}>+ Add an email for order updates</TextAction>
        )}

        {error && <AuthAlert>{error}</AuthAlert>}

        <Button type="submit" size="lg" block loading={status === "loading"}>
          {status === "loading" ? "Sending code..." : "Send code"}
        </Button>
      </form>

      <p className="mt-6 text-[13px] leading-[1.5] text-[var(--muted)]">
        By continuing you agree to our{" "}
        <Link href="/terms" className="underline underline-offset-2 hover:text-[var(--ink)]">Terms</Link> and{" "}
        <Link href="/privacy" className="underline underline-offset-2 hover:text-[var(--ink)]">Privacy Policy</Link>.
      </p>
    </div>
  );
}
