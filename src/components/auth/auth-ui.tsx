"use client";

import { forwardRef, useId, useState } from "react";
import { AlertCircle, Check, ChevronDown, Eye, EyeOff, Info } from "lucide-react";
import { cn } from "@/lib/utils";
import { evaluatePassword } from "@/lib/auth/password-policy";

/* Shared building blocks for every auth screen (login, signup, customer, and
   the verify/reset cards). Kept in one file because they are small and always
   change together — a field's error semantics, for example, must be identical
   everywhere or screen-reader users get a different form on each page. */

export function AuthHeading({ title, subtitle }: { title: string; subtitle?: React.ReactNode }) {
  return (
    <div className="mb-8">
      <h1 className="font-display text-28 font-semibold tracking-[-0.02em] text-[var(--ink)]">{title}</h1>
      {subtitle && <p className="mt-2 text-[15px] leading-[1.5] text-[var(--muted)]">{subtitle}</p>}
    </div>
  );
}

const inputCls =
  "themed-input h-12 w-full rounded-lg px-4 text-[15px] disabled:cursor-not-allowed disabled:opacity-50 " +
  "aria-[invalid=true]:border-[var(--sig-danger-fg)]";

interface TextFieldProps extends React.InputHTMLAttributes<HTMLInputElement> {
  label: string;
  error?: string;
  hint?: React.ReactNode;
  /** Rendered inside the input's left edge, e.g. a "+91" country code. */
  prefix?: string;
  /** Right-aligned slot in the label row (e.g. a "Forgot password?" link). */
  labelAction?: React.ReactNode;
  mono?: boolean;
  /** Trailing control inside the input (the password visibility toggle). */
  trailing?: React.ReactNode;
}

export const TextField = forwardRef<HTMLInputElement, TextFieldProps>(function TextField(
  { label, error, hint, prefix, labelAction, mono, trailing, className, id, ...props },
  ref
) {
  const auto = useId();
  const fieldId = id ?? auto;
  const hintId = `${fieldId}-hint`;
  const errorId = `${fieldId}-error`;
  const describedBy = [error ? errorId : null, hint ? hintId : null].filter(Boolean).join(" ") || undefined;

  return (
    <div>
      <div className="mb-1.5 flex items-baseline justify-between gap-3">
        <label htmlFor={fieldId} className="text-14 font-medium text-[var(--ink)]">
          {label}
        </label>
        {labelAction}
      </div>
      <div className="relative">
        {prefix && (
          <span className="pointer-events-none absolute left-4 top-1/2 -translate-y-1/2 border-r border-[var(--line)] pr-3 text-[15px] text-[var(--muted)]" aria-hidden>
            {prefix}
          </span>
        )}
        <input
          ref={ref}
          id={fieldId}
          aria-invalid={error ? true : undefined}
          aria-describedby={describedBy}
          className={cn(inputCls, prefix && "pl-[68px]", trailing && "pr-12", mono && "font-mono tracking-[0.02em]", className)}
          {...props}
        />
        {trailing}
      </div>
      {error ? (
        <p id={errorId} className="mt-1.5 text-[13px] font-medium text-[var(--sig-danger-fg)]" role="alert">
          {error}
        </p>
      ) : hint ? (
        <p id={hintId} className="mt-1.5 text-[13px] text-[var(--muted)]">
          {hint}
        </p>
      ) : null}
    </div>
  );
});

interface PasswordFieldProps extends Omit<TextFieldProps, "type" | "trailing" | "prefix" | "mono"> {
  value: string;
  /** Show the live strength meter + rule checklist (signup / reset only). */
  showStrength?: boolean;
}

export const PasswordField = forwardRef<HTMLInputElement, PasswordFieldProps>(function PasswordField(
  { value, showStrength, hint, onKeyUp, onBlur, ...props },
  ref
) {
  const [visible, setVisible] = useState(false);
  const [capsLock, setCapsLock] = useState(false);

  return (
    <div>
      <TextField
        ref={ref}
        {...props}
        value={value}
        type={visible ? "text" : "password"}
        autoCapitalize="none"
        autoCorrect="off"
        spellCheck={false}
        onKeyUp={(e) => {
          setCapsLock(e.getModifierState?.("CapsLock") ?? false);
          onKeyUp?.(e);
        }}
        onBlur={(e) => {
          setCapsLock(false);
          onBlur?.(e);
        }}
        hint={capsLock ? <span className="font-medium text-[var(--sig-warn-fg)]">Caps Lock is on</span> : hint}
        trailing={
          <button
            type="button"
            onClick={() => setVisible((v) => !v)}
            aria-label={visible ? "Hide password" : "Show password"}
            aria-pressed={visible}
            className="absolute right-1.5 top-1/2 grid h-9 w-9 -translate-y-1/2 place-items-center rounded-md text-[var(--muted)] transition-colors hover:text-[var(--ink)] focus-visible:outline-2 focus-visible:outline-[var(--focus-ring)]"
          >
            {visible ? <EyeOff size={17} aria-hidden /> : <Eye size={17} aria-hidden />}
          </button>
        }
      />
      {showStrength && <PasswordStrength password={value} />}
    </div>
  );
});

const SEGMENT_TONE = ["", "bg-[var(--sig-danger-fg)]", "bg-[var(--sig-warn-fg)]", "bg-[var(--sig-ok-fg)]", "bg-[var(--sig-ok-fg)]"];

export function PasswordStrength({ password }: { password: string }) {
  const { rules, score, label } = evaluatePassword(password);
  return (
    <div className="mt-3">
      <div className="flex items-center gap-3">
        <div className="grid flex-1 grid-cols-4 gap-1" aria-hidden>
          {[1, 2, 3, 4].map((n) => (
            <span key={n} className={cn("h-1 rounded-full transition-colors duration-[var(--dur-2)]", n <= score ? SEGMENT_TONE[score] : "bg-[var(--line)]")} />
          ))}
        </div>
        <span className="w-12 text-right text-12 font-medium text-[var(--muted)]" aria-live="polite">
          {label}
        </span>
      </div>
      <ul className="mt-2.5 grid grid-cols-2 gap-x-4 gap-y-1">
        {rules.map((r) => (
          <li key={r.id} className={cn("flex items-center gap-1.5 text-12 transition-colors", r.met ? "text-[var(--sig-ok-fg)]" : "text-[var(--muted)]")}>
            <Check size={12} strokeWidth={r.met ? 3 : 2} className={r.met ? "opacity-100" : "opacity-30"} aria-hidden />
            {r.label}
            <span className="sr-only">{r.met ? " — met" : " — not met"}</span>
          </li>
        ))}
      </ul>
    </div>
  );
}

export function AuthAlert({ tone = "danger", children, className }: { tone?: "danger" | "info"; children: React.ReactNode; className?: string }) {
  const Icon = tone === "danger" ? AlertCircle : Info;
  return (
    <div
      role={tone === "danger" ? "alert" : "status"}
      className={cn(
        "flex items-start gap-2.5 rounded-lg border px-3.5 py-3 text-14 leading-[1.45]",
        tone === "danger"
          ? "border-[var(--sig-danger-bd)] bg-[var(--sig-danger-bg)] text-[var(--sig-danger-fg)]"
          : "border-[var(--sig-info-bd)] bg-[var(--sig-info-bg)] text-[var(--sig-info-fg)]",
        className
      )}
    >
      <Icon size={16} className="mt-0.5 flex-shrink-0" aria-hidden />
      <div className="min-w-0 flex-1">{children}</div>
    </div>
  );
}

/** Quiet text-button used for "back" / "use another method" style secondary actions. */
export function TextAction({ className, ...props }: React.ButtonHTMLAttributes<HTMLButtonElement>) {
  return (
    <button
      type="button"
      className={cn(
        "text-14 text-[var(--muted)] underline-offset-4 transition-colors hover:text-[var(--ink)] hover:underline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-[var(--focus-ring)]",
        className
      )}
      {...props}
    />
  );
}

/** Underline tabs — a real tablist, replaces the old pill toggle floating above the card. */
export function AuthTabs<T extends string>({
  tabs,
  value,
  onChange,
  label,
}: {
  tabs: { id: T; label: string }[];
  value: T;
  onChange: (id: T) => void;
  label: string;
}) {
  return (
    <div role="tablist" aria-label={label} className="mb-8 flex gap-6 border-b border-[var(--line)]">
      {tabs.map((t) => {
        const selected = t.id === value;
        return (
          <button
            key={t.id}
            type="button"
            role="tab"
            id={`tab-${t.id}`}
            aria-selected={selected}
            aria-controls={`panel-${t.id}`}
            tabIndex={selected ? 0 : -1}
            onClick={() => onChange(t.id)}
            onKeyDown={(e) => {
              if (e.key !== "ArrowRight" && e.key !== "ArrowLeft") return;
              const i = tabs.findIndex((x) => x.id === value);
              const next = tabs[(i + (e.key === "ArrowRight" ? 1 : tabs.length - 1)) % tabs.length];
              onChange(next.id);
              document.getElementById(`tab-${next.id}`)?.focus();
            }}
            className={cn(
              "-mb-px border-b-2 pb-3 text-[15px] transition-colors focus-visible:outline-2 focus-visible:outline-offset-4 focus-visible:outline-[var(--focus-ring)]",
              selected ? "border-[var(--ink)] font-semibold text-[var(--ink)]" : "border-transparent text-[var(--muted)] hover:text-[var(--ink)]"
            )}
          >
            {t.label}
          </button>
        );
      })}
    </div>
  );
}

interface SelectFieldProps extends React.SelectHTMLAttributes<HTMLSelectElement> {
  label: string;
  error?: string;
}

export const SelectField = forwardRef<HTMLSelectElement, SelectFieldProps>(function SelectField({ label, error, id, className, children, ...props }, ref) {
  const auto = useId();
  const fieldId = id ?? auto;
  const errorId = `${fieldId}-error`;
  return (
    <div>
      <label htmlFor={fieldId} className="mb-1.5 block text-14 font-medium text-[var(--ink)]">
        {label}
      </label>
      <div className="relative">
        <select
          ref={ref}
          id={fieldId}
          aria-invalid={error ? true : undefined}
          aria-describedby={error ? errorId : undefined}
          className={cn(inputCls, "appearance-none pr-10", className)}
          {...props}
        >
          {children}
        </select>
        <ChevronDown size={16} className="pointer-events-none absolute right-4 top-1/2 -translate-y-1/2 text-[var(--muted)]" aria-hidden />
      </div>
      {error && (
        <p id={errorId} className="mt-1.5 text-[13px] font-medium text-[var(--sig-danger-fg)]" role="alert">
          {error}
        </p>
      )}
    </div>
  );
});
