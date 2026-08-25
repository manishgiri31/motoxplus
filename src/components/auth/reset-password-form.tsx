"use client";

import { useState } from "react";
import { useSearchParams } from "next/navigation";
import Link from "next/link";
import { Eye, EyeOff, Check, CheckCircle } from "lucide-react";
import { OtpInput } from "./otp-input";
import { Spinner } from "@/components/ui/spinner";
import { CountdownTimer } from "./countdown-timer";

type Step = "enter-code" | "new-password" | "success";

const RESEND_COOLDOWN_SECONDS = 60;

const inputCls =
  "w-full themed-input border focus:border-red-600/60 rounded-sm px-4 py-3 text-sm outline-none transition-colors";

export function ResetPasswordForm() {
  const params = useSearchParams();
  const initialUid = params.get("uid") || "";
  const method = params.get("method") === "mobile" ? "mobile" : "email";
  const contact = params.get("contact") || "";

  const [userId, setUserId] = useState(initialUid);
  const [step, setStep] = useState<Step>("enter-code");
  const [otp, setOtp] = useState("");
  const [resetToken, setResetToken] = useState("");

  const [newPassword, setNewPassword] = useState("");
  const [confirmPassword, setConfirmPassword] = useState("");
  const [showPw1, setShowPw1] = useState(false);
  const [showPw2, setShowPw2] = useState(false);

  const [status, setStatus] = useState<"idle" | "loading">("idle");
  const [error, setError] = useState("");

  if (!userId) {
    return (
      <div className="bg-[var(--card)] border border-[var(--line)] rounded-sm p-8 text-center">
        <p className="text-red-400 mb-4">This reset link is invalid or has expired.</p>
        <Link href="/forgot-password" className="text-red-400 hover:text-red-300 font-semibold">
          Request a new code
        </Link>
      </div>
    );
  }

  async function handleVerify(e: React.FormEvent) {
    e.preventDefault();
    if (otp.length !== 6) {
      setError("Enter the 6-digit code");
      return;
    }
    setStatus("loading");
    setError("");
    const res = await fetch("/api/auth/verify-forgot-password-otp", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ userId, otp }),
    });
    const data = await res.json();
    if (!res.ok) {
      setError(data.error || "Invalid or expired code");
      setStatus("idle");
      setOtp("");
      return;
    }
    setResetToken(data.resetToken);
    setStatus("idle");
    setStep("new-password");
  }

  async function handleResend() {
    if (!contact) {
      setError("Can't resend — please start over.");
      throw new Error("missing contact");
    }
    const body = method === "mobile" ? { mobile: contact, method: "mobile" } : { email: contact, method: "email" };
    const res = await fetch("/api/auth/forgot-password", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(body),
    });
    const data = await res.json();
    if (!res.ok) {
      setError(data.error || "Couldn't resend the code");
      throw new Error(data.error || "Resend failed");
    }
    setUserId(data.userId);
    setOtp("");
    setError("");
  }

  const requirements = [
    { label: "At least 8 characters", met: newPassword.length >= 8 },
    { label: "One uppercase letter", met: /[A-Z]/.test(newPassword) },
    { label: "One lowercase letter", met: /[a-z]/.test(newPassword) },
    { label: "One number", met: /\d/.test(newPassword) },
  ];
  const allRequirementsMet = requirements.every((r) => r.met);
  const confirmMismatch = confirmPassword.length > 0 && confirmPassword !== newPassword;

  async function handleReset(e: React.FormEvent) {
    e.preventDefault();
    setError("");
    if (!allRequirementsMet) {
      setError("Password does not meet the requirements below");
      return;
    }
    if (newPassword !== confirmPassword) {
      setError("Passwords do not match");
      return;
    }
    setStatus("loading");
    const res = await fetch("/api/auth/reset-password", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ userId, resetToken, newPassword }),
    });
    const data = await res.json();
    if (!res.ok) {
      setError(data.error || "Password reset failed");
      setStatus("idle");
      return;
    }
    setStatus("idle");
    setStep("success");
  }

  if (step === "success") {
    return (
      <div className="bg-[var(--card)] border border-[var(--line)] rounded-sm p-8 text-center">
        <CheckCircle className="mx-auto mb-4 text-green-500" size={48} />
        <h1 className="text-2xl font-black text-[var(--text-primary)] mb-2">Password reset successful</h1>
        <p className="text-[var(--text-muted)] text-sm mb-6">
          Your password has been updated successfully. You can now sign in with your new password.
        </p>
        <Link
          href="/login"
          className="inline-block bg-red-600 hover:bg-red-700 text-white font-bold py-3 px-8 rounded-sm transition-colors uppercase tracking-wider text-sm"
        >
          Back to login
        </Link>
      </div>
    );
  }

  return (
    <div className="bg-[var(--card)] border border-[var(--line)] rounded-sm p-8">
      {step === "enter-code" && (
        <form onSubmit={handleVerify} className="space-y-6">
          <div>
            <h1 className="text-2xl font-black text-[var(--text-primary)] mb-2">Enter reset code</h1>
            <p className="text-[var(--text-muted)] text-sm">
              We sent a password reset code to your {method === "mobile" ? "mobile number" : "email address"}.
            </p>
          </div>

          <div>
            <label className="sr-only" htmlFor="reset-otp">
              6-digit code
            </label>
            <OtpInput value={otp} onChange={setOtp} disabled={status === "loading"} />
          </div>

          <div aria-live="polite">
            {error && (
              <div className="bg-red-900/20 border border-red-900/40 rounded-sm px-4 py-3 text-red-400 text-sm text-center" role="alert">
                {error}
              </div>
            )}
          </div>

          <button
            type="submit"
            disabled={status === "loading" || otp.length !== 6}
            className="w-full inline-flex items-center justify-center gap-2 bg-red-600 hover:bg-red-700 disabled:opacity-50 text-white font-bold py-4 rounded-sm transition-colors uppercase tracking-wider text-sm"
          >
            {status === "loading" ? (
              <>
                <Spinner size={15} /> Verifying...
              </>
            ) : (
              "Verify code"
            )}
          </button>

          <div className="text-center">
            <p className="text-[var(--text-muted)] text-sm mb-1">Didn&apos;t receive the code?</p>
            <CountdownTimer seconds={RESEND_COOLDOWN_SECONDS} onResend={handleResend} label="Resend" compact />
          </div>
        </form>
      )}

      {step === "new-password" && (
        <form onSubmit={handleReset} className="space-y-4">
          <h1 className="text-2xl font-black text-[var(--text-primary)] mb-2">Create a new password</h1>

          <div>
            <label htmlFor="new-password" className="text-[var(--text-muted)] text-xs uppercase tracking-wider block mb-2">
              New password
            </label>
            <div className="relative">
              <input
                id="new-password"
                required
                type={showPw1 ? "text" : "password"}
                autoComplete="new-password"
                value={newPassword}
                onChange={(e) => setNewPassword(e.target.value)}
                placeholder="Enter a new password"
                className={inputCls + " pr-12"}
              />
              <button
                type="button"
                onClick={() => setShowPw1(!showPw1)}
                className="absolute right-4 top-1/2 -translate-y-1/2 text-[var(--text-muted)] hover:text-[var(--text-secondary)] transition-colors"
                aria-label={showPw1 ? "Hide password" : "Show password"}
              >
                {showPw1 ? <EyeOff size={16} /> : <Eye size={16} />}
              </button>
            </div>
          </div>

          <ul className="space-y-1 text-xs">
            {requirements.map((r) => (
              <li key={r.label} className={`flex items-center gap-2 ${r.met ? "text-green-400" : "text-[var(--text-muted)]"}`}>
                <Check size={13} className={r.met ? "opacity-100" : "opacity-30"} />
                {r.label}
              </li>
            ))}
          </ul>

          <div>
            <label htmlFor="confirm-password" className="text-[var(--text-muted)] text-xs uppercase tracking-wider block mb-2">
              Confirm new password
            </label>
            <div className="relative">
              <input
                id="confirm-password"
                required
                type={showPw2 ? "text" : "password"}
                autoComplete="new-password"
                value={confirmPassword}
                onChange={(e) => setConfirmPassword(e.target.value)}
                placeholder="Repeat your new password"
                className={inputCls + " pr-12"}
                aria-invalid={confirmMismatch}
                aria-describedby={confirmMismatch ? "confirm-password-error" : undefined}
              />
              <button
                type="button"
                onClick={() => setShowPw2(!showPw2)}
                className="absolute right-4 top-1/2 -translate-y-1/2 text-[var(--text-muted)] hover:text-[var(--text-secondary)] transition-colors"
                aria-label={showPw2 ? "Hide password" : "Show password"}
              >
                {showPw2 ? <EyeOff size={16} /> : <Eye size={16} />}
              </button>
            </div>
            {confirmMismatch && (
              <p id="confirm-password-error" role="alert" className="mt-2 text-xs text-red-400">
                Passwords do not match
              </p>
            )}
          </div>

          {error && (
            <div className="bg-red-900/20 border border-red-900/40 rounded-sm px-4 py-3 text-red-400 text-sm" role="alert">
              {error}
            </div>
          )}

          <button
            type="submit"
            disabled={status === "loading" || !allRequirementsMet || !confirmPassword || confirmMismatch}
            className="w-full inline-flex items-center justify-center gap-2 bg-red-600 hover:bg-red-700 disabled:opacity-50 text-white font-bold py-4 rounded-sm transition-colors uppercase tracking-wider text-sm"
          >
            {status === "loading" ? (
              <>
                <Spinner size={15} /> Resetting...
              </>
            ) : (
              "Reset password"
            )}
          </button>
        </form>
      )}
    </div>
  );
}
