"use client";

import * as React from "react";
import { Check, Eye, EyeOff, FileText, Upload, X } from "lucide-react";
import { Checkbox, FieldError, FieldHint, Input } from "@/components/ui/field";
import { cn } from "@/lib/utils";
import { ACCEPT_ATTR, DOC_RULES, STEP_IDS, STEP_LABELS, type DocKey, type StepId } from "@/lib/seller/registration";

// ───────────── multi-select as a real fieldset of checkboxes ─────────────

export function CheckGroup({
  legend,
  name,
  options,
  value,
  onChange,
  error,
  hint,
  required,
  disabled,
}: {
  legend: string;
  name: string;
  options: readonly string[];
  value: string[];
  onChange: (next: string[]) => void;
  error?: string;
  hint?: string;
  required?: boolean;
  disabled?: boolean;
}) {
  const errId = error ? `${name}-error` : undefined;
  const hintId = hint ? `${name}-hint` : undefined;
  return (
    <fieldset
      data-invalid={error ? "true" : undefined}
      aria-describedby={[hintId, errId].filter(Boolean).join(" ") || undefined}
      className="min-w-0"
    >
      <legend className="mb-2 text-xs font-semibold text-[var(--text-secondary)]">
        {legend}
        {required && <span className="ml-0.5 text-[var(--sig-danger-fg)]">*</span>}
      </legend>
      <div className="grid grid-cols-1 gap-px border border-[var(--input-border)] bg-[var(--input-border)] sm:grid-cols-2">
        {options.map((opt) => {
          const checked = value.includes(opt);
          const id = `${name}-${opt.replace(/\W+/g, "-").toLowerCase()}`;
          return (
            <label
              key={opt}
              htmlFor={id}
              className={cn(
                "flex cursor-pointer items-center gap-3 px-3 py-2.5 text-sm transition-colors",
                checked ? "bg-[var(--accent-soft)] text-mx-black" : "bg-white text-[var(--text-primary)] hover:bg-mx-off",
                disabled && "cursor-not-allowed opacity-60"
              )}
            >
              <Checkbox
                id={id}
                checked={checked}
                disabled={disabled}
                onChange={() => onChange(checked ? value.filter((v) => v !== opt) : [...value, opt])}
              />
              {opt}
            </label>
          );
        })}
      </div>
      {error ? <FieldError id={errId}>{error}</FieldError> : hint ? <FieldHint id={hintId}>{hint}</FieldHint> : null}
    </fieldset>
  );
}

// ───────────── password with reveal ─────────────

export const PasswordInput = React.forwardRef<
  HTMLInputElement,
  React.InputHTMLAttributes<HTMLInputElement> & { invalid?: boolean }
>(function PasswordInput({ className, ...props }, ref) {
  const [shown, setShown] = React.useState(false);
  return (
    <div className="relative">
      <Input ref={ref} type={shown ? "text" : "password"} className={cn("pr-11", className)} {...props} />
      <button
        type="button"
        onClick={() => setShown((s) => !s)}
        aria-pressed={shown}
        aria-label={shown ? "Hide password" : "Show password"}
        className="absolute inset-y-0 right-0 grid w-11 place-items-center text-[var(--text-muted)] hover:text-mx-black focus-visible:outline-2 focus-visible:outline-offset-[-2px] focus-visible:outline-mx-black"
      >
        {shown ? <EyeOff aria-hidden className="size-4" /> : <Eye aria-hidden className="size-4" />}
      </button>
    </div>
  );
});

// ───────────── document upload ─────────────

function formatSize(bytes: number): string {
  return bytes >= 1024 * 1024 ? `${(bytes / 1024 / 1024).toFixed(1)} MB` : `${Math.max(1, Math.round(bytes / 1024))} KB`;
}

export function FileField({
  docKey,
  required,
  hint,
  file,
  error,
  onChange,
  label,
}: {
  docKey: DocKey;
  required?: boolean;
  hint?: string;
  file?: File;
  error?: string;
  onChange: (file: File | undefined) => void;
  label?: string;
}) {
  const rule = DOC_RULES[docKey];
  const errId = error ? `${docKey}-error` : undefined;
  const hintId = hint ? `${docKey}-hint` : undefined;
  const inputRef = React.useRef<HTMLInputElement>(null);
  const text = label ?? rule.label;

  return (
    <div>
      <p className="mb-1.5 text-xs font-semibold text-[var(--text-secondary)]" id={`${docKey}-label`}>
        {text}
        {required && <span className="ml-0.5 text-[var(--sig-danger-fg)]">*</span>}
        {!required && <span className="ml-1.5 font-normal text-[var(--text-muted)]">Optional</span>}
      </p>
      <div
        className={cn(
          "flex min-h-[52px] items-center gap-3 border bg-white px-3 py-2",
          error ? "border-[var(--sig-danger-fg)]" : "border-[var(--input-border)]"
        )}
      >
        {/* visually hidden but focusable: the label below is the visible, clickable control */}
        <input
          ref={inputRef}
          id={docKey}
          type="file"
          accept={ACCEPT_ATTR[docKey]}
          aria-labelledby={`${docKey}-label`}
          aria-describedby={[hintId, errId].filter(Boolean).join(" ") || undefined}
          aria-invalid={!!error}
          className="peer sr-only"
          onChange={(e) => {
            onChange(e.target.files?.[0]);
            e.target.value = ""; // allow re-selecting the same file after a removal
          }}
        />
        {file ? (
          <>
            <FileText aria-hidden className="size-5 shrink-0 text-mx-red" />
            <span className="min-w-0 flex-1 text-sm">
              <span className="block truncate font-medium text-mx-black">{file.name}</span>
              <span className="text-xs text-[var(--text-muted)]">{formatSize(file.size)}</span>
            </span>
            <button
              type="button"
              onClick={() => onChange(undefined)}
              aria-label={`Remove ${text}`}
              className="grid size-9 place-items-center text-[var(--text-muted)] hover:text-mx-black focus-visible:outline-2 focus-visible:outline-mx-black"
            >
              <X aria-hidden className="size-4" />
            </button>
          </>
        ) : (
          <label
            htmlFor={docKey}
            className="flex flex-1 cursor-pointer items-center gap-3 text-sm text-[var(--text-secondary)] peer-focus-visible:outline-2"
          >
            <span className="inline-flex h-9 items-center gap-2 border border-mx-black px-3 font-grotesk text-[12px] font-semibold uppercase tracking-[0.08em] text-mx-black hover:bg-mx-black hover:text-white">
              <Upload aria-hidden className="size-3.5" /> Choose file
            </span>
            <span className="text-xs text-[var(--text-muted)]">
              {ACCEPT_ATTR[docKey].replace(/\./g, "").replace(/,/g, ", ").toUpperCase()} · max {Math.round(rule.maxBytes / 1024 / 1024)} MB
            </span>
          </label>
        )}
      </div>
      {error ? <FieldError id={errId}>{error}</FieldError> : hint ? <FieldHint id={hintId}>{hint}</FieldHint> : null}
    </div>
  );
}

// ───────────── progress ─────────────

export function StepRail({
  current,
  reached,
  onGo,
}: {
  current: StepId;
  /** Highest step index the applicant has validated up to; steps beyond it are not reachable by click. */
  reached: number;
  onGo: (step: StepId) => void;
}) {
  const idx = STEP_IDS.indexOf(current);
  return (
    <nav aria-label="Application progress">
      {/* compact bar for phones and tablets */}
      <div className="bp-lg:hidden">
        <p className="font-grotesk text-[13px] font-semibold uppercase tracking-[0.14em] text-mx-black">
          Step {idx + 1} of {STEP_IDS.length} <span className="text-[#6b6b73]">· {STEP_LABELS[current]}</span>
        </p>
        <div className="mt-3 flex gap-1" aria-hidden>
          {STEP_IDS.map((s, i) => (
            <span key={s} className={cn("h-1 flex-1", i <= idx ? "bg-mx-red" : "bg-mx-silver/60")} />
          ))}
        </div>
      </div>

      <ol className="hidden bp-lg:block">
        {STEP_IDS.map((s, i) => {
          const done = i < idx;
          const active = i === idx;
          const reachable = i <= reached && !active;
          return (
            <li key={s} className="relative pb-7 last:pb-0">
              {i < STEP_IDS.length - 1 && (
                <span aria-hidden className={cn("absolute left-[15px] top-8 h-[calc(100%-2rem)] w-px", done ? "bg-mx-red" : "bg-mx-silver")} />
              )}
              <button
                type="button"
                disabled={!reachable}
                onClick={() => onGo(s)}
                aria-current={active ? "step" : undefined}
                className="group flex items-center gap-4 text-left disabled:cursor-default focus-visible:outline-2 focus-visible:outline-offset-4 focus-visible:outline-mx-black"
              >
                <span
                  className={cn(
                    "grid size-8 shrink-0 place-items-center border-2 font-grotesk text-[13px] font-semibold tabular-nums",
                    done && "border-mx-red bg-mx-red text-white",
                    active && "border-mx-black bg-mx-black text-white",
                    !done && !active && "border-mx-silver bg-white text-[#6b6b73]"
                  )}
                >
                  {done ? <Check aria-hidden className="size-4" strokeWidth={3} /> : i + 1}
                </span>
                <span
                  className={cn(
                    "font-grotesk text-[14px] font-semibold uppercase tracking-[0.08em]",
                    active ? "text-mx-black" : done ? "text-mx-black group-hover:underline" : "text-[#6b6b73]"
                  )}
                >
                  {STEP_LABELS[s]}
                </span>
              </button>
            </li>
          );
        })}
      </ol>
    </nav>
  );
}
