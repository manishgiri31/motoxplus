"use client";

import { useEffect, useState } from "react";
import { useSearchParams } from "next/navigation";
import Link from "next/link";
import { ChevronLeft } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Spinner } from "@/components/ui/spinner";
import { AuthAlert, AuthHeading, PasswordField } from "./auth-ui";
import { OtpInput } from "./otp-input";
import { CountdownTimer } from "./countdown-timer";
import { RESEND_COOLDOWN_SECONDS } from "./auth-otp-step";
import { validateNewPassword } from "@/lib/auth/password-policy";
import { maskEmail } from "@/lib/customer/signup";
import { safeFetch } from "@/lib/safe-fetch";

type Step = "code" | "password" | "done";

// Step 2 of resetting a password (step 1 is /forgot-password): the 6-digit
// code, then the new password. Rules come from the shared password policy, the
// same one the server enforces. Resetting signs out every other session.
export function ResetPasswordForm() {
  const params = useSearchParams();
  const method = params.get("method") === "mobile" ? "mobile" : "email";
  const contact = params.get("contact") || "";

  const [userId, setUserId] = useState(params.get("uid") || "");
  const [step, setStep] = useState<Step>("code");
  const [otp, setOtp] = useState("");
  const [resetToken, setResetToken] = useState("");

  const [password, setPassword] = useState("");
  const [confirm, setConfirm] = useState("");
  const [passwordError, setPasswordError] = useState("");
  const [confirmError, setConfirmError] = useState("");

  const [loading, setLoading] = useState(false);
  const [error, setError] = useState("");

  async function verifyCode(code: string) {
    setLoading(true);
    setError("");
    const res = await safeFetch("/api/auth/verify-forgot-password-otp", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ userId, otp: code }),
    });
    const data = await res.json().catch(() => ({}));
    setLoading(false);
    if (!res.ok) {
      setError(data.error || "Invalid or expired code");
      setOtp("");
      return;
    }
    setResetToken(data.resetToken);
    setStep("password");
  }

  // Submit as soon as the 6th digit is in.
  useEffect(() => {
    if (step === "code" && otp.length === 6 && !loading) verifyCode(otp);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [otp]);

  async function resend() {
    const res = await safeFetch("/api/auth/forgot-password", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(method === "mobile" ? { method, mobile: contact } : { method, email: contact }),
    });
    const data = await res.json().catch(() => ({}));
    if (!res.ok) {
      setError(data.error || "Couldn't resend the code");
      throw new Error("resend failed");
    }
    setUserId(data.userId);
    setOtp("");
    setError("");
  }

  async function savePassword(e: React.FormEvent) {
    e.preventDefault();
    if (loading) return;
    const problem = validateNewPassword(password);
    setPasswordError(problem ?? "");
    setConfirmError(confirm !== password ? "Passwords don't match" : "");
    if (problem || confirm !== password) return;

    setLoading(true);
    setError("");
    const res = await safeFetch("/api/auth/reset-password", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ userId, resetToken, newPassword: password }),
    });
    const data = await res.json().catch(() => ({}));
    setLoading(false);
    if (!res.ok) {
      setError(data.error || "Couldn't update the password. Start again.");
      return;
    }
    setStep("done");
  }

  if (!userId || !contact) {
    return (
      <div>
        <AuthHeading title="This link has expired" subtitle="Request a new code to reset your password." />
        <Button asChild size="lg" block>
          <Link href="/forgot-password">Request a new code</Link>
        </Button>
      </div>
    );
  }

  if (step === "done") {
    return (
      <div>
        <AuthHeading
          title="Password updated"
          subtitle="Sign in with your mobile number or email and the new password. You've been signed out on other devices."
        />
        <Button asChild size="lg" block>
          <Link href="/login">Sign in</Link>
        </Button>
      </div>
    );
  }

  if (step === "password") {
    return (
      <div>
        <AuthHeading title="Choose a new password" />
        <form onSubmit={savePassword} className="space-y-5" noValidate>
          <PasswordField
            label="New password"
            autoComplete="new-password"
            autoFocus
            showStrength
            value={password}
            error={passwordError}
            onChange={(e) => { setPassword(e.target.value); setPasswordError(""); }}
          />
          <PasswordField
            label="Confirm new password"
            autoComplete="new-password"
            value={confirm}
            error={confirmError}
            onChange={(e) => { setConfirm(e.target.value); setConfirmError(""); }}
          />
          {error && <AuthAlert>{error}</AuthAlert>}
          <Button type="submit" size="lg" block loading={loading}>
            {loading ? "Saving..." : "Save password"}
          </Button>
        </form>
      </div>
    );
  }

  const destination = method === "mobile" ? `+91 ••••• ••${contact.slice(-2)}` : maskEmail(contact);
  return (
    <div>
      <AuthHeading
        title="Enter the code"
        subtitle={
          <>
            If an account uses <span className="font-semibold text-[var(--ink)]">{destination}</span>, we sent it a 6-digit code
            {method === "mobile" ? " on WhatsApp" : " by email"}. It expires in 5 minutes.
          </>
        }
      />
      <div className="space-y-5">
        <OtpInput value={otp} onChange={(v) => { setOtp(v); if (error) setError(""); }} disabled={loading} autoFocus invalid={!!error} />
        <div aria-live="polite" className="min-h-[20px]">
          {loading && (
            <p className="flex items-center gap-2 text-14 text-[var(--muted)]"><Spinner size={13} /> Checking...</p>
          )}
          {error && !loading && <AuthAlert>{error}</AuthAlert>}
        </div>
        <div className="flex items-center justify-between gap-4 border-t border-[var(--line)] pt-5">
          <CountdownTimer seconds={RESEND_COOLDOWN_SECONDS} onResend={resend} label="Resend code" compact />
          <Link href="/forgot-password" className="inline-flex items-center gap-1 text-14 text-[var(--muted)] underline-offset-4 hover:text-[var(--ink)] hover:underline">
            <ChevronLeft size={14} aria-hidden /> Change
          </Link>
        </div>
      </div>
    </div>
  );
}
