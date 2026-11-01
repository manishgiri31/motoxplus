"use client";

import { useRef, KeyboardEvent, ClipboardEvent } from "react";

interface OtpInputProps {
  value: string;
  onChange: (value: string) => void;
  length?: number;
  disabled?: boolean;
  autoFocus?: boolean;
  invalid?: boolean;
}

export function OtpInput({ value, onChange, length = 6, disabled = false, autoFocus = false, invalid = false }: OtpInputProps) {
  const inputRefs = useRef<(HTMLInputElement | null)[]>([]);

  const digits = value.split("").concat(Array(length).fill("")).slice(0, length);

  function fill(raw: string, from: number) {
    const incoming = raw.replace(/\D/g, "").slice(0, length - from);
    if (!incoming) return;
    const next = [...digits];
    for (let i = 0; i < incoming.length; i++) next[from + i] = incoming[i];
    onChange(next.join(""));
    inputRefs.current[Math.min(from + incoming.length, length - 1)]?.focus();
  }

  function handleChange(index: number, raw: string) {
    // Android/iOS one-time-code autofill drops the whole code into the focused
    // box in one event, so this must accept more than one character.
    if (raw.replace(/\D/g, "").length > 1) {
      fill(raw, index === length - 1 ? 0 : index);
      return;
    }
    const d = raw.replace(/\D/g, "").slice(0, 1);
    const next = [...digits];
    next[index] = d;
    onChange(next.join(""));
    if (d && index < length - 1) inputRefs.current[index + 1]?.focus();
  }

  function handleKeyDown(index: number, e: KeyboardEvent<HTMLInputElement>) {
    if (e.key === "Backspace") {
      const next = [...digits];
      if (!digits[index] && index > 0) {
        inputRefs.current[index - 1]?.focus();
        next[index - 1] = "";
      } else {
        next[index] = "";
      }
      onChange(next.join(""));
    } else if (e.key === "ArrowLeft" && index > 0) {
      inputRefs.current[index - 1]?.focus();
    } else if (e.key === "ArrowRight" && index < length - 1) {
      inputRefs.current[index + 1]?.focus();
    }
  }

  function handlePaste(e: ClipboardEvent<HTMLInputElement>) {
    e.preventDefault();
    fill(e.clipboardData.getData("text"), 0);
  }

  return (
    <div className="flex justify-between gap-2 sm:gap-3" role="group" aria-label={`${length}-digit verification code`}>
      {Array.from({ length }).map((_, i) => (
        <input
          key={i}
          ref={(el) => { inputRefs.current[i] = el; }}
          type="text"
          inputMode="numeric"
          pattern="[0-9]*"
          autoComplete={i === 0 ? "one-time-code" : "off"}
          autoFocus={autoFocus && i === 0}
          value={digits[i] || ""}
          disabled={disabled}
          aria-label={`Digit ${i + 1} of ${length}`}
          aria-invalid={invalid || undefined}
          onChange={(e) => handleChange(i, e.target.value)}
          onKeyDown={(e) => handleKeyDown(i, e)}
          onPaste={handlePaste}
          onFocus={(e) => e.target.select()}
          className="themed-input h-14 min-w-0 flex-1 rounded-lg text-center font-mono text-[22px] font-medium disabled:opacity-40 aria-[invalid=true]:border-[var(--sig-danger-fg)]"
          style={{ caretColor: "transparent" }}
        />
      ))}
    </div>
  );
}
