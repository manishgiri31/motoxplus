"use client";

import { useEffect, useState } from "react";
import { useSearchParams } from "next/navigation";
import Link from "next/link";
import { Button } from "@/components/ui/button";
import { AuthOtpStep } from "./auth-otp-step";
import { AuthAlert, AuthHeading, TextField } from "./auth-ui";
import { normalizeIndianMobile } from "@/lib/phone";
import { landingPathForRole, safeCallbackTarget } from "@/lib/auth/safe-redirect";

type Step = "phone" | "otp";

// Returning-customer sign-in: mobile number → WhatsApp code → back to the
// catalogue (or wherever callbackUrl points). New customers go to /signup,
// which collects name, email and address and verifies both phone and email.
// /api/auth/login-otp answers the same way whether or not the number is
// registered, so the "create an account" link stays visible on both steps.
export function CustomerAuthForm() {
  const searchParams = useSearchParams();
  const callbackParam = searchParams.get("callbackUrl");
  const signupHref = callbackParam ? `/signup?callbackUrl=${encodeURIComponent(callbackParam)}` : "/signup";

  const [step, setStep] = useState<Step>("phone");
  const [phone, setPhone] = useState("");
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
      const res = await fetch("/api/auth/login-otp", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ method: "mobile", mobile: normalizedPhone }),
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

  async function handlePhoneSubmit(e: React.FormEvent) {
    e.preventDefault();
    if (status === "loading") return;
    if (!normalizedPhone) {
      setPhoneError("Enter a valid 10-digit mobile number");
      return;
    }
    if (await requestOtp()) {
      setOtp("");
      setTimerKey((k) => k + 1);
      setStep("otp");
    }
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
    // Same-origin paths only (see safe-redirect.ts). Customers land on the
    // catalogue; a dealer who typed their own number lands in their portal.
    window.location.href = safeCallbackTarget(callbackParam, landingPathForRole(data.user?.role));
  }

  useEffect(() => {
    if (otp.length === 6 && status !== "loading") verifyOtp(otp);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [otp]);

  const newHere = (
    <p className="mt-8 border-t border-[var(--line)] pt-6 text-14 text-[var(--muted)]">
      New to MOTOXPLUS?{" "}
      <Link href={signupHref} className="font-semibold text-[var(--accent-text)] underline-offset-4 hover:underline">
        Create an account
      </Link>
    </p>
  );

  if (step === "otp") {
    return (
      <div>
        <AuthOtpStep
          destination={`+91 ••••• ••${normalizedPhone.slice(-2)}`}
          channel="WhatsApp"
          otp={otp}
          onOtpChange={(v) => { setOtp(v); if (error) setError(""); }}
          status={status}
          error={error}
          timerKey={timerKey}
          onResend={async () => { if (!(await requestOtp())) throw new Error("Resend failed"); }}
          onBack={() => { setStep("phone"); setError(""); setStatus("idle"); }}
          backLabel="Change number"
        />
        <p className="mt-6 text-[13px] leading-[1.5] text-[var(--muted)]">
          No code? Codes only go to numbers with an account.{" "}
          <Link href={signupHref} className="font-medium text-[var(--accent-text)] underline-offset-4 hover:underline">
            Create one
          </Link>
          .
        </p>
      </div>
    );
  }

  return (
    <div>
      <AuthHeading title="Welcome back" subtitle="Enter your mobile number. We'll send a one-time code on WhatsApp." />

      <form onSubmit={handlePhoneSubmit} className="space-y-5" noValidate>
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

        {error && <AuthAlert>{error}</AuthAlert>}

        <Button type="submit" size="lg" block loading={status === "loading"}>
          {status === "loading" ? "Sending code..." : "Send code"}
        </Button>
      </form>

      {newHere}
    </div>
  );
}
