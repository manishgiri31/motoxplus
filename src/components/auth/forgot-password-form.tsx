"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import Link from "next/link";
import { ChevronLeft } from "lucide-react";
import { Button } from "@/components/ui/button";
import { AuthAlert, AuthHeading, TextField } from "./auth-ui";
import { normalizeIndianMobile } from "@/lib/phone";
import { safeFetch } from "@/lib/safe-fetch";

// Step 1 of resetting a password: mobile number or email, same single box as
// the sign-in form. A code goes to WhatsApp (mobile) or email; /reset-password
// takes the code and the new password. The response looks the same whether or
// not the account exists, so this screen can't be used to find accounts.
export function ForgotPasswordForm() {
  const router = useRouter();
  const [contact, setContact] = useState("");
  const [fieldError, setFieldError] = useState("");
  const [apiError, setApiError] = useState("");
  const [loading, setLoading] = useState(false);

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    if (loading) return;
    const mobile = normalizeIndianMobile(contact);
    const email = contact.trim().toLowerCase();
    if (!mobile && !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email)) {
      setFieldError("Enter your 10-digit mobile number or email address");
      return;
    }
    const method = mobile ? "mobile" : "email";
    const value = mobile ?? email;

    setLoading(true);
    setApiError("");
    const res = await safeFetch("/api/auth/forgot-password", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(mobile ? { method, mobile } : { method, email }),
    });
    const data = await res.json().catch(() => ({}));
    if (!res.ok) {
      setApiError(data.error || "Something went wrong. Please try again.");
      setLoading(false);
      return;
    }
    // userId is an opaque flow id when the account doesn't exist (see the route).
    const params = new URLSearchParams({ uid: data.userId, method, contact: value });
    router.push(`/reset-password?${params.toString()}`);
  }

  return (
    <div>
      <AuthHeading
        title="Reset your password"
        subtitle="Enter the mobile number or email on your account. We'll send a code to set a new password."
      />

      <form onSubmit={handleSubmit} className="space-y-5" noValidate>
        <TextField
          label="Mobile number or email"
          type="text"
          autoFocus
          autoCapitalize="none"
          autoCorrect="off"
          spellCheck={false}
          autoComplete="username"
          placeholder="98765 43210 or you@example.com"
          value={contact}
          error={fieldError}
          hint="A mobile number gets the code on WhatsApp; an email gets it by email."
          onChange={(e) => { setContact(e.target.value); setFieldError(""); setApiError(""); }}
        />

        {apiError && <AuthAlert>{apiError}</AuthAlert>}

        <Button type="submit" size="lg" block loading={loading}>
          {loading ? "Sending code..." : "Send code"}
        </Button>
      </form>

      <Link
        href="/login"
        className="mt-8 inline-flex items-center gap-1 text-14 text-[var(--muted)] underline-offset-4 hover:text-[var(--ink)] hover:underline"
      >
        <ChevronLeft size={14} aria-hidden /> Back to sign in
      </Link>
    </div>
  );
}
