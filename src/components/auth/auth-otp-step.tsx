"use client";

import { ChevronLeft } from "lucide-react";
import { OtpInput } from "./otp-input";
import { CountdownTimer } from "./countdown-timer";
import { AuthAlert, AuthHeading, TextAction } from "./auth-ui";
import { Spinner } from "@/components/ui/spinner";

// How long "Resend code" stays disabled after a send. Deliberately much
// shorter than OTP_EXPIRY_MINUTES (5 min, server-side) — the cooldown only
// exists to stop accidental double-sends, not to mirror how long the code
// stays valid (a hardcoded 300s here once left "Resend" disabled for the
// code's whole lifetime). Per-account and per-IP abuse limits are enforced
// server-side regardless of what this timer says.
export const RESEND_COOLDOWN_SECONDS = 45;

interface AuthOtpStepProps {
  /** Masked destination, e.g. "+91 ••••• ••10" or "r***@shop.in" — never the raw value. */
  destination: string;
  channel: "WhatsApp" | "email";
  otp: string;
  onOtpChange: (v: string) => void;
  status: "idle" | "loading" | "error";
  error: string;
  timerKey: number;
  onResend: () => Promise<void>;
  onBack: () => void;
  backLabel: string;
}

// Shared "enter the 6-digit code" screen for the trade login and the customer
// sign-in — both used to carry their own near-identical copy, which is how
// the two drifted on error handling and a11y in the first place.
export function AuthOtpStep({ destination, channel, otp, onOtpChange, status, error, timerKey, onResend, onBack, backLabel }: AuthOtpStepProps) {
  return (
    <div>
      <AuthHeading
        title="Enter the code"
        subtitle={
          <>
            We sent a 6-digit code to <span className="font-semibold text-[var(--ink)]">{destination}</span> on {channel}. It expires in 5 minutes.
          </>
        }
      />
      <div className="space-y-5">
        <OtpInput value={otp} onChange={onOtpChange} disabled={status === "loading"} autoFocus invalid={!!error} />
        <div aria-live="polite" className="min-h-[20px]">
          {status === "loading" && (
            <p className="flex items-center gap-2 text-14 text-[var(--muted)]">
              <Spinner size={13} /> Verifying...
            </p>
          )}
          {error && status !== "loading" && <AuthAlert>{error}</AuthAlert>}
        </div>
        <div className="flex items-center justify-between gap-4 border-t border-[var(--line)] pt-5">
          <CountdownTimer key={timerKey} seconds={RESEND_COOLDOWN_SECONDS} onResend={onResend} label="Resend code" compact />
          <TextAction onClick={onBack} className="inline-flex items-center gap-1">
            <ChevronLeft size={14} aria-hidden /> {backLabel}
          </TextAction>
        </div>
      </div>
    </div>
  );
}
