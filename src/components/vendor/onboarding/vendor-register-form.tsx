"use client";

import * as React from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { Button } from "@/components/ui/button";
import { AuthAlert, AuthHeading, PasswordField, TextField } from "@/components/auth/auth-ui";
import { ApiError, NetworkError } from "@/lib/api/client";
import { validateNewPassword } from "@/lib/auth/password-policy";
import { normalizeIndianMobile } from "@/lib/phone";
import { registerVendor } from "@/lib/vendor/onboarding";

type Values = { fullName: string; mobile: string; email: string; password: string; confirmPassword: string };

/**
 * Vendor account step (/become-vendor/register). Same shape as dealer signup: create the account, sign in with the
 * same credentials (existing /api/auth/login, which sets the web session), then email and mobile verification via
 * the shared /verify-email and /verify-mobile pages. Business details come after, inside /vendor/onboarding.
 */
export function VendorRegisterForm() {
  const router = useRouter();
  const [v, setV] = React.useState<Values>({ fullName: "", mobile: "", email: "", password: "", confirmPassword: "" });
  const [errors, setErrors] = React.useState<Partial<Record<keyof Values, string>>>({});
  const [banner, setBanner] = React.useState("");
  const [busy, setBusy] = React.useState(false);
  const formRef = React.useRef<HTMLFormElement>(null);

  const on = (k: keyof Values) => (e: React.ChangeEvent<HTMLInputElement>) => {
    setV((s) => ({ ...s, [k]: e.target.value }));
    setErrors((er) => ({ ...er, [k]: undefined }));
  };

  function validate(): Partial<Record<keyof Values, string>> {
    const e: Partial<Record<keyof Values, string>> = {};
    if (v.fullName.trim().length < 2) e.fullName = "Enter your full name";
    if (!normalizeIndianMobile(v.mobile)) e.mobile = "Enter a valid 10-digit Indian mobile number";
    if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(v.email.trim())) e.email = "Enter a valid email address";
    const pw = validateNewPassword(v.password, { email: v.email, name: v.fullName });
    if (pw) e.password = pw;
    else if (v.password !== v.confirmPassword) e.confirmPassword = "Passwords do not match";
    return e;
  }

  async function submit(e: React.FormEvent) {
    e.preventDefault();
    setBanner("");
    const errs = validate();
    setErrors(errs);
    if (Object.keys(errs).length) {
      requestAnimationFrame(() => formRef.current?.querySelector<HTMLElement>("[aria-invalid='true']")?.focus());
      return;
    }

    setBusy(true);
    const email = v.email.trim().toLowerCase();
    let userId: string;
    try {
      const res = await registerVendor({ fullName: v.fullName.trim(), mobile: v.mobile, email, password: v.password });
      userId = res.userId;
    } catch (err) {
      setBusy(false);
      if (err instanceof ApiError && err.fieldErrors && Object.keys(err.fieldErrors).length) {
        setErrors(err.fieldErrors as Partial<Record<keyof Values, string>>);
        setBanner(err.status === 409 ? err.message : "Please fix the highlighted fields.");
      } else if (err instanceof ApiError && err.status === 429) {
        setBanner(`Too many attempts. Try again in ${err.retryAfterSeconds ?? 60} seconds.`);
      } else if (err instanceof ApiError && [404, 501, 502, 503, 504].includes(err.status)) {
        setBanner("Vendor registration isn't available right now. Your account has not been created; please try again later.");
      } else if (err instanceof NetworkError) {
        setBanner("We couldn't reach the server. Check your connection; your account has not been created.");
      } else {
        setBanner(err instanceof Error ? err.message : "Registration failed. Please try again.");
      }
      return;
    }

    // Account exists from here on. Sign in with the same credentials so verification can continue.
    try {
      const res = await fetch("/api/auth/login", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ email, password: v.password }),
      });
      if (!res.ok) throw new Error("login failed");
      router.replace(`/verify-email?userId=${encodeURIComponent(userId)}`);
    } catch {
      // Rare: registration worked but automatic sign-in didn't. The account is fine; send them to log in.
      router.replace(`/login?callbackUrl=${encodeURIComponent("/vendor/onboarding")}&registered=vendor`);
    }
  }

  return (
    <div>
      <AuthHeading
        title="Create your vendor account"
        subtitle={
          <>
            Step 1 of 3: your login. Next we verify your email and mobile, then you add business details.{" "}
            <span className="whitespace-nowrap">
              Already registered?{" "}
              <Link href="/login?callbackUrl=%2Fvendor%2Fonboarding" className="font-medium text-[var(--accent-text)] hover:underline">
                Sign in
              </Link>
            </span>
          </>
        }
      />
      {banner && <AuthAlert className="mb-5">{banner}</AuthAlert>}
      <form ref={formRef} onSubmit={submit} noValidate className="space-y-4">
        <TextField label="Full name" name="fullName" autoComplete="name" value={v.fullName} onChange={on("fullName")} error={errors.fullName} maxLength={100} />
        <TextField
          label="Mobile number"
          name="mobile"
          prefix="+91"
          inputMode="numeric"
          autoComplete="tel-national"
          value={v.mobile}
          onChange={on("mobile")}
          error={errors.mobile}
          hint="We send a one-time code to verify it."
          maxLength={14}
        />
        <TextField label="Business email" name="email" type="email" autoComplete="email" value={v.email} onChange={on("email")} error={errors.email} maxLength={254} />
        <PasswordField label="Password" name="password" autoComplete="new-password" value={v.password} onChange={on("password")} error={errors.password} showStrength />
        <PasswordField
          label="Confirm password"
          name="confirmPassword"
          autoComplete="new-password"
          value={v.confirmPassword}
          onChange={on("confirmPassword")}
          error={errors.confirmPassword}
        />
        <Button type="submit" size="lg" block loading={busy} disabled={busy}>
          Create vendor account
        </Button>
        <p className="text-center text-12 leading-relaxed text-[var(--muted)]">
          By continuing you agree to the MotoXPlus <Link href="/terms" className="underline underline-offset-2">terms</Link> and{" "}
          <Link href="/privacy" className="underline underline-offset-2">privacy policy</Link>. You&apos;ll accept the vendor agreement before submitting your application.
        </p>
      </form>
    </div>
  );
}
