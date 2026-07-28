import * as React from "react";
import { cn } from "@/lib/utils";

/**
 * Replaces the INPUT/LABEL/SECTION/SECTION_TITLE constants duplicated
 * (byte-for-byte except focus colour) in product-form.tsx and
 * vendor-product-form.tsx, plus ~49 other inline input class-strings across
 * 9 files. One accent (`--accent`) everywhere — the old amber-vs-red focus
 * divergence between portals disappears; set `--accent` per-layout in
 * Phase 3 if a per-portal accent is still wanted.
 */
const inputBase =
  "w-full rounded-sm border bg-[var(--input-bg)] border-[var(--input-border)] px-3 py-2.5 text-sm " +
  "text-[var(--text-primary)] placeholder:text-[var(--text-muted)] transition-[border-color,box-shadow] " +
  "duration-[var(--dur-1)] outline-none " +
  "focus:border-[var(--accent-hover)] focus:shadow-[0_0_0_3px_var(--accent-ring)] " +
  "disabled:opacity-50 disabled:cursor-not-allowed";

const inputError = "border-[var(--sig-danger-bd)] focus:border-[var(--sig-danger-fg)] focus:shadow-[0_0_0_3px_var(--sig-danger-bd)]";

export const Input = React.forwardRef<HTMLInputElement, React.InputHTMLAttributes<HTMLInputElement> & { invalid?: boolean }>(
  ({ className, invalid, ...props }, ref) => (
    <input ref={ref} className={cn(inputBase, invalid && inputError, className)} {...props} />
  )
);
Input.displayName = "Input";

export const Textarea = React.forwardRef<
  HTMLTextAreaElement,
  React.TextareaHTMLAttributes<HTMLTextAreaElement> & { invalid?: boolean }
>(({ className, invalid, ...props }, ref) => (
  <textarea ref={ref} className={cn(inputBase, "min-h-[100px] resize-y", invalid && inputError, className)} {...props} />
));
Textarea.displayName = "Textarea";

export const Select = React.forwardRef<HTMLSelectElement, React.SelectHTMLAttributes<HTMLSelectElement> & { invalid?: boolean }>(
  ({ className, invalid, children, ...props }, ref) => (
    <select ref={ref} className={cn(inputBase, "bg-[var(--bg-secondary)]", invalid && inputError, className)} {...props}>
      {children}
    </select>
  )
);
Select.displayName = "Select";

export function Checkbox({ className, ...props }: React.InputHTMLAttributes<HTMLInputElement>) {
  return (
    <input
      type="checkbox"
      className={cn(
        "h-4 w-4 rounded-md border border-[var(--input-border)] bg-[var(--input-bg)]",
        "accent-[var(--accent)] cursor-pointer",
        "focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-[var(--focus-ring)]",
        className
      )}
      {...props}
    />
  );
}

export function Switch({
  checked,
  onCheckedChange,
  className,
  disabled,
}: {
  checked: boolean;
  onCheckedChange: (checked: boolean) => void;
  className?: string;
  disabled?: boolean;
}) {
  return (
    <button
      type="button"
      role="switch"
      aria-checked={checked}
      disabled={disabled}
      onClick={() => onCheckedChange(!checked)}
      className={cn(
        "relative inline-flex h-5 w-9 flex-shrink-0 items-center rounded-full transition-colors duration-[var(--dur-2)]",
        "focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-[var(--focus-ring)]",
        "disabled:opacity-45 disabled:cursor-not-allowed",
        checked ? "bg-[var(--accent)]" : "bg-[var(--border-strong)]",
        className
      )}
    >
      <span
        className={cn(
          "inline-block h-3.5 w-3.5 transform rounded-full bg-white shadow transition-transform duration-[var(--dur-2)]",
          checked ? "translate-x-[18px]" : "translate-x-1"
        )}
      />
    </button>
  );
}

export function Label({ className, required, children, ...props }: React.LabelHTMLAttributes<HTMLLabelElement> & { required?: boolean }) {
  return (
    <label className={cn("mb-1.5 block text-xs font-semibold text-[var(--text-secondary)]", className)} {...props}>
      {children}
      {required && <span className="ml-0.5 text-[var(--sig-danger-fg)]">*</span>}
    </label>
  );
}

export function FieldHint({ children, className, id }: { children: React.ReactNode; className?: string; id?: string }) {
  return (
    <p id={id} className={cn("mt-1.5 text-[11px] text-[var(--text-muted)]", className)}>
      {children}
    </p>
  );
}

export function FieldError({ children, className, id }: { children?: React.ReactNode; className?: string; id?: string }) {
  if (!children) return null;
  return (
    <p id={id} className={cn("mt-1.5 text-[11px] font-medium text-[var(--sig-danger-fg)]", className)}>
      {children}
    </p>
  );
}

export function Field({
  label,
  name,
  required,
  hint,
  error,
  span,
  children,
  className,
}: {
  label: string;
  name: string;
  required?: boolean;
  hint?: string;
  error?: string;
  span?: 1 | 2 | 3 | 4;
  children: React.ReactElement<{ id?: string; "aria-describedby"?: string; "aria-invalid"?: boolean; invalid?: boolean }>;
  className?: string;
}) {
  const hintId = hint ? `${name}-hint` : undefined;
  const errorId = error ? `${name}-error` : undefined;
  const describedBy = [hintId, errorId].filter(Boolean).join(" ") || undefined;

  const control = React.cloneElement(children, {
    id: name,
    "aria-describedby": describedBy,
    "aria-invalid": !!error,
    invalid: !!error,
  });

  return (
    <div className={cn(span && SPAN_CLASS[span], className)}>
      <Label htmlFor={name} required={required}>
        {label}
      </Label>
      {control}
      {error ? <FieldError id={errorId}>{error}</FieldError> : hint ? <FieldHint id={hintId}>{hint}</FieldHint> : null}
    </div>
  );
}

// Literal class names, never interpolated — Tailwind's JIT only picks up class
// strings that appear verbatim in source. A template-literal `md:col-span-${span}`
// would work in dev and silently vanish from the production build, the same
// failure mode .scratch/audit-tokens.js exists to catch for CSS vars.
const SPAN_CLASS: Record<1 | 2 | 3 | 4, string> = {
  1: "md:col-span-1",
  2: "md:col-span-2",
  3: "md:col-span-3",
  4: "md:col-span-4",
};

export function FormSection({
  title,
  description,
  columns = 2,
  children,
  className,
}: {
  title: string;
  description?: string;
  columns?: 1 | 2 | 3;
  children: React.ReactNode;
  className?: string;
}) {
  const colsClass = columns === 1 ? "md:grid-cols-1" : columns === 3 ? "md:grid-cols-3" : "md:grid-cols-2";
  return (
    <section className={cn("py-6 border-b border-[var(--border-subtle)] last:border-0", className)}>
      <div className="mb-4">
        <h3 className="text-sm font-bold text-[var(--text-primary)]">{title}</h3>
        {description && <p className="mt-0.5 text-xs text-[var(--text-muted)]">{description}</p>}
      </div>
      <div className={cn("grid grid-cols-1 gap-4", colsClass)}>{children}</div>
    </section>
  );
}

export function FormGrid({ columns = 2, className, children }: { columns?: 1 | 2 | 3 | 4; className?: string; children: React.ReactNode }) {
  const colsClass = { 1: "md:grid-cols-1", 2: "md:grid-cols-2", 3: "md:grid-cols-3", 4: "md:grid-cols-4" }[columns];
  return <div className={cn("grid grid-cols-1 gap-4", colsClass, className)}>{children}</div>;
}

export function FormActions({ children, sticky, className }: { children: React.ReactNode; sticky?: boolean; className?: string }) {
  return (
    <div
      className={cn(
        "flex items-center justify-end gap-2 pt-6 mt-6 border-t border-[var(--border-subtle)]",
        sticky && "sticky bottom-0 bg-[var(--bg-card)]",
        className
      )}
    >
      {children}
    </div>
  );
}
