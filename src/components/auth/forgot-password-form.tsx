"use client";

import { useId, useState } from "react";
import { useRouter } from "next/navigation";
import Link from "next/link";
import { Mail, Phone } from "lucide-react";
import { Spinner } from "@/components/ui/spinner";

type Method = "email" | "mobile";

const EMAIL_REGEX = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;

const inputCls =
  "w-full themed-input border focus:border-red-600/60 rounded-sm px-4 py-3 text-sm outline-none transition-colors";

export function ForgotPasswordForm() {
  const router = useRouter();
  const fieldId = useId();

  const [method, setMethod] = useState<Method>("email");
  const [contact, setContact] = useState("");
  const [fieldError, setFieldError] = useState("");
  const [apiError, setApiError] = useState("");
  const [status, setStatus] = useState<"idle" | "loading">("idle");

  function switchMethod(next: Method) {
    setMethod(next);
    setContact("");
    setFieldError("");
    setApiError("");
  }

  function validate(): string | null {
    if (method === "email") {
      const trimmed = contact.trim();
      if (!trimmed) return "Email address is required";
      if (!EMAIL_REGEX.test(trimmed)) return "Enter a valid email address";
      return null;
    }
    if (!contact) return "Mobile number is required";
    if (contact.length !== 10) return "Enter a valid 10-digit mobile number";
    return null;
  }

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    setApiError("");
    const validationError = validate();
    if (validationError) {
      setFieldError(validationError);
      return;
    }
    setFieldError("");
    setStatus("loading");

    const body =
      method === "email"
        ? { email: contact.trim().toLowerCase(), method: "email" }
        : { mobile: contact, method: "mobile" };

    try {
      const res = await fetch("/api/auth/forgot-password", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(body),
      });
      const data = await res.json();
      if (!res.ok) {
        setApiError(data.error || "Something went wrong. Please try again.");
        setStatus("idle");
        return;
      }
      // Same generic success path whether or not the account exists — userId
      // here is an opaque flow id in the non-existent-account case (see the
      // forgot-password route), never a signal of account existence.
      const params = new URLSearchParams({ uid: data.userId, method, contact: contact.trim() });
      router.push(`/reset-password?${params.toString()}`);
    } catch {
      setApiError("Network error. Please try again.");
      setStatus("idle");
    }
  }

  return (
    <div className="glass border border-[var(--border-color)] rounded-sm p-8">
      <h1 className="text-2xl font-black text-[var(--text-primary)] mb-2">Forgot your password?</h1>
      <p className="text-[var(--text-muted)] text-sm mb-6">
        {method === "email"
          ? "Enter your registered email address and we'll send you a password reset code."
          : "Enter your registered mobile number and we'll send you a password reset code."}
      </p>

      <div className="flex gap-2 mb-6" role="tablist" aria-label="Reset method">
        <button
          type="button"
          role="tab"
          aria-selected={method === "email"}
          onClick={() => switchMethod("email")}
          className={`flex-1 inline-flex items-center justify-center gap-1.5 rounded-sm border px-3 py-2 text-xs font-semibold uppercase tracking-wider transition-colors ${
            method === "email"
              ? "border-red-600/60 bg-red-900/20 text-red-400"
              : "border-[var(--border-color)] text-[var(--text-muted)] hover:border-red-600/40"
          }`}
        >
          <Mail size={13} /> Email
        </button>
        <button
          type="button"
          role="tab"
          aria-selected={method === "mobile"}
          onClick={() => switchMethod("mobile")}
          className={`flex-1 inline-flex items-center justify-center gap-1.5 rounded-sm border px-3 py-2 text-xs font-semibold uppercase tracking-wider transition-colors ${
            method === "mobile"
              ? "border-red-600/60 bg-red-900/20 text-red-400"
              : "border-[var(--border-color)] text-[var(--text-muted)] hover:border-red-600/40"
          }`}
        >
          <Phone size={13} /> Mobile
        </button>
      </div>

      <form onSubmit={handleSubmit} className="space-y-4" noValidate>
        <div>
          <label htmlFor={fieldId} className="text-[var(--text-muted)] text-xs uppercase tracking-wider block mb-2">
            {method === "email" ? "Email address" : "Mobile number"}
          </label>
          {method === "email" ? (
            <input
              id={fieldId}
              type="email"
              autoFocus
              autoComplete="email"
              value={contact}
              onChange={(e) => {
                setContact(e.target.value);
                setFieldError("");
              }}
              className={inputCls}
              placeholder="Enter your email address"
              aria-invalid={!!fieldError}
              aria-describedby={fieldError ? `${fieldId}-error` : undefined}
            />
          ) : (
            <div className="flex gap-2">
              <span className="themed-input border rounded-sm px-3 py-3 text-sm text-[var(--text-muted)] whitespace-nowrap">
                +91
              </span>
              <input
                id={fieldId}
                type="tel"
                autoFocus
                autoComplete="tel"
                inputMode="numeric"
                value={contact}
                onChange={(e) => {
                  setContact(e.target.value.replace(/\D/g, "").slice(0, 10));
                  setFieldError("");
                }}
                className={inputCls}
                placeholder="10-digit mobile number"
                maxLength={10}
                aria-invalid={!!fieldError}
                aria-describedby={fieldError ? `${fieldId}-error` : undefined}
              />
            </div>
          )}
          {fieldError && (
            <p id={`${fieldId}-error`} role="alert" className="mt-2 text-xs text-red-400">
              {fieldError}
            </p>
          )}
        </div>

        {apiError && (
          <div className="bg-red-900/20 border border-red-900/40 rounded-sm px-4 py-3 text-red-400 text-sm" role="alert">
            {apiError}
          </div>
        )}

        <button
          type="submit"
          disabled={status === "loading"}
          className="w-full inline-flex items-center justify-center gap-2 bg-red-600 hover:bg-red-700 disabled:opacity-50 text-white font-bold py-4 rounded-sm transition-colors uppercase tracking-wider text-sm"
        >
          {status === "loading" ? (
            <>
              <Spinner size={15} /> Sending...
            </>
          ) : (
            "Send reset code"
          )}
        </button>

        <div className="text-center">
          <Link href="/login" className="text-[var(--text-muted)] text-sm hover:text-[var(--text-secondary)] transition-colors">
            ← Back to login
          </Link>
        </div>
      </form>
    </div>
  );
}
