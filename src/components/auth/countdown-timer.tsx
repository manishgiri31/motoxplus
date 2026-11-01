"use client";

import { useEffect, useState } from "react";

interface CountdownTimerProps {
  seconds: number;
  onComplete?: () => void;
  onResend?: () => Promise<void>;
  label?: string;
  /** Show "{label} in Ns" instead of the MM:SS clock — reads better for short (<60s) windows. Also left-aligns. */
  compact?: boolean;
}

export function CountdownTimer({ seconds, onComplete, onResend, label = "Resend OTP", compact = false }: CountdownTimerProps) {
  const [remaining, setRemaining] = useState(seconds);
  const [resending, setResending] = useState(false);
  const [key, setKey] = useState(0);

  useEffect(() => {
    setRemaining(seconds);
  }, [seconds, key]);

  useEffect(() => {
    if (remaining <= 0) {
      onComplete?.();
      return;
    }
    const timer = setTimeout(() => setRemaining((r) => r - 1), 1000);
    return () => clearTimeout(timer);
  }, [remaining, onComplete]);

  async function handleResend() {
    if (!onResend || resending) return;
    setResending(true);
    try {
      await onResend();
      setKey((k) => k + 1);
      setRemaining(seconds);
    } catch {
      // The caller surfaces its own error; keep the button available for a retry.
    } finally {
      setResending(false);
    }
  }

  const mm = String(Math.floor(remaining / 60)).padStart(2, "0");
  const ss = String(remaining % 60).padStart(2, "0");
  const align = compact ? "" : "text-center";

  if (remaining > 0) {
    return (
      <p className={`text-14 text-[var(--muted)] ${align}`}>
        {compact ? <>{label} in </> : <>Resend in </>}
        <span className="font-mono font-medium tabular-nums text-[var(--ink)]">{compact && remaining < 60 ? `${remaining}s` : `${mm}:${ss}`}</span>
      </p>
    );
  }

  return (
    <button
      type="button"
      onClick={handleResend}
      disabled={resending}
      className={`text-14 font-medium text-[var(--accent-text)] underline-offset-4 transition-colors hover:underline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-[var(--focus-ring)] disabled:opacity-50 ${compact ? "" : "w-full text-center"}`}
    >
      {resending ? "Sending..." : label}
    </button>
  );
}
