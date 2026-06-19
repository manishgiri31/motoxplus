"use client";

import { useEffect, useState } from "react";

interface CountdownTimerProps {
  seconds: number;
  onComplete?: () => void;
  onResend?: () => Promise<void>;
  label?: string;
}

export function CountdownTimer({ seconds, onComplete, onResend, label = "Resend OTP" }: CountdownTimerProps) {
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
    } finally {
      setResending(false);
    }
  }

  const mm = String(Math.floor(remaining / 60)).padStart(2, "0");
  const ss = String(remaining % 60).padStart(2, "0");

  if (remaining > 0) {
    return (
      <p className="text-center text-sm text-[var(--text-muted)]">
        Resend in{" "}
        <span className="font-mono text-red-400 font-bold">
          {mm}:{ss}
        </span>
      </p>
    );
  }

  return (
    <button
      type="button"
      onClick={handleResend}
      disabled={resending}
      className="w-full text-center text-sm text-red-400 hover:text-red-300 transition-colors disabled:opacity-50"
    >
      {resending ? "Sending..." : label}
    </button>
  );
}
