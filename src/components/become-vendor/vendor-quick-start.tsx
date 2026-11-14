"use client";

import * as React from "react";
import Link from "next/link";
import { useSession } from "next-auth/react";
import { ArrowRight, Check, Mail, MessageCircle } from "lucide-react";
import { Button } from "@/components/ui/button";
import { AuthAlert, PasswordField, TextAction, TextField } from "@/components/auth/auth-ui";
import { OtpInput } from "@/components/auth/otp-input";
import { ApiError, NetworkError } from "@/lib/api/client";
import { validateNewPassword } from "@/lib/auth/password-policy";
import { normalizeIndianMobile } from "@/lib/phone";
import { safeFetch } from "@/lib/safe-fetch";
import { registerVendor } from "@/lib/vendor/onboarding";
import { ctaClass } from "./styles";

type Values = { fullName: string; businessName: string; mobile: string; email: string; password: string };
type Stage = { kind: "form" } | { kind: "verify"; userId: string; email: string; mobile: string };

const EMAIL_RE = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;

/**
 * Becoming a vendor in one place (/become-vendor): one short form, then both one-time codes in the same card, then
 * business-profile completion; the dashboard opens once that is submitted. Vendors are approved automatically
 * (like dealers); KYC documents are optional.
 *
 * The account is created by the Java API (POST /api/v1/vendors/register, which also emails the code); sign-in,
 * the WhatsApp/SMS code and both verifications use the same Node endpoints as every other signup.
 */
export function VendorQuickStart() {
  const [stage, setStage] = React.useState<Stage>({ kind: "form" });
  return (
    <div className="border border-black/15 bg-white p-5 shadow-[0_1px_0_rgba(0,0,0,0.04)] sm:p-7">
      {stage.kind === "form" ? <SignupStep onDone={setStage} /> : <VerifyStep {...stage} />}
    </div>
  );
}

function SignupStep({ onDone }: { onDone: (s: Stage) => void }) {
  const [v, setV] = React.useState<Values>({ fullName: "", businessName: "", mobile: "", email: "", password: "" });
  const [errors, setErrors] = React.useState<Partial<Record<keyof Values, string>>>({});
  const [banner, setBanner] = React.useState<React.ReactNode>("");
  const [busy, setBusy] = React.useState(false);
  const formRef = React.useRef<HTMLFormElement>(null);

  const on = (k: keyof Values) => (e: React.ChangeEvent<HTMLInputElement>) => {
    setV((s) => ({ ...s, [k]: e.target.value }));
    setErrors((er) => ({ ...er, [k]: undefined }));
  };

  function validate() {
    const e: Partial<Record<keyof Values, string>> = {};
    if (v.fullName.trim().length < 2) e.fullName = "Enter your name";
    if (v.businessName.trim().length < 2) e.businessName = "Enter your business name";
    if (!normalizeIndianMobile(v.mobile)) e.mobile = "Enter a valid 10-digit mobile number";
    if (!EMAIL_RE.test(v.email.trim())) e.email = "Enter a valid email address";
    const pw = validateNewPassword(v.password, { email: v.email, name: v.fullName });
    if (pw) e.password = pw;
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
    const mobile = normalizeIndianMobile(v.mobile)!;
    let userId: string;
    try {
      const res = await registerVendor({
        fullName: v.fullName.trim(),
        businessName: v.businessName.trim(),
        mobile,
        email,
        password: v.password,
      });
      userId = res.userId;
    } catch (err) {
      setBusy(false);
      if (err instanceof ApiError && err.status === 409) {
        setErrors((err.fieldErrors ?? {}) as Partial<Record<keyof Values, string>>);
        setBanner(
          <>
            This email or mobile already has a MotoXPlus account.{" "}
            <Link href="/login?callbackUrl=%2Fbecome-vendor%23start" className="font-semibold underline underline-offset-2">
              Sign in
            </Link>{" "}
            and add selling to the same login; no second account needed.
          </>
        );
      } else if (err instanceof ApiError && err.fieldErrors && Object.keys(err.fieldErrors).length) {
        setErrors(err.fieldErrors as Partial<Record<keyof Values, string>>);
        setBanner("Please fix the highlighted fields.");
      } else if (err instanceof ApiError && err.status === 429) {
        setBanner(`Too many attempts. Try again in ${err.retryAfterSeconds ?? 60} seconds.`);
      } else if (err instanceof NetworkError || (err instanceof ApiError && err.status >= 500)) {
        setBanner("We couldn't reach the server. Your account has not been created; please try again.");
      } else {
        setBanner(err instanceof Error ? err.message : "Registration failed. Please try again.");
      }
      return;
    }

    // The account exists from here on: sign in, then send the WhatsApp/SMS code (the email code is already on its way).
    try {
      const login = await fetch("/api/auth/login", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ email, password: v.password }),
      });
      if (!login.ok) throw new Error("login");
    } catch {
      window.location.assign(`/login?callbackUrl=${encodeURIComponent("/vendor/onboarding")}&registered=vendor`);
      return;
    }
    await safeFetch("/api/auth/send-mobile-otp", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ mobile }),
    }).catch(() => undefined); // the verify step offers "Resend" if this didn't go out
    onDone({ kind: "verify", userId, email, mobile });
  }

  return (
    <form ref={formRef} onSubmit={submit} noValidate aria-labelledby="start-title">
      <h2 id="start-title" className="font-grotesk text-[24px] font-semibold tracking-[-0.02em] text-mx-black">
        Become a vendor
      </h2>
      <p className="mt-1 text-[14px] leading-relaxed text-[#5b5b63]">
        One form. Verify your email and mobile, and your vendor account is active.
      </p>
      {banner && <AuthAlert className="mt-4">{banner}</AuthAlert>}
      <div className="mt-5 grid gap-4 sm:grid-cols-2">
        <TextField label="Your name" name="fullName" autoComplete="name" value={v.fullName} onChange={on("fullName")} error={errors.fullName} maxLength={100} />
        <TextField
          label="Business name"
          name="businessName"
          autoComplete="organization"
          value={v.businessName}
          onChange={on("businessName")}
          error={errors.businessName}
          maxLength={120}
        />
        <TextField
          label="Mobile"
          name="mobile"
          prefix="+91"
          inputMode="numeric"
          autoComplete="tel-national"
          value={v.mobile}
          onChange={on("mobile")}
          error={errors.mobile}
          maxLength={14}
        />
        <TextField label="Email" name="email" type="email" autoComplete="email" value={v.email} onChange={on("email")} error={errors.email} maxLength={254} />
      </div>
      <div className="mt-4">
        <PasswordField
          label="Create a password"
          name="password"
          autoComplete="new-password"
          value={v.password}
          onChange={on("password")}
          error={errors.password}
          showStrength
        />
      </div>
      <Button type="submit" size="lg" block loading={busy} disabled={busy} className={`mt-5 ${ctaClass}`}>
        Create vendor account <ArrowRight aria-hidden />
      </Button>
      <p className="mt-3 text-[12px] leading-relaxed text-[#6b6b73]">
        By continuing you agree to the MotoXPlus{" "}
        <Link href="/terms" className="underline underline-offset-2">
          terms
        </Link>{" "}
        and{" "}
        <Link href="/privacy" className="underline underline-offset-2">
          privacy policy
        </Link>
        . Already a dealer or customer?{" "}
        <Link href="/login?callbackUrl=%2Fbecome-vendor%23start" className="font-semibold text-mx-black underline underline-offset-2">
          Sign in
        </Link>{" "}
        to sell with the same login.
      </p>
    </form>
  );
}

function friendly(raw: string) {
  if (/expired/i.test(raw)) return "This code has expired. Send a new one.";
  if (/too many/i.test(raw)) return "Too many attempts. Send a new code.";
  if (/incorrect|invalid/i.test(raw)) return "That code is not right. Check it and try again.";
  return raw;
}

function VerifyStep({ userId, email, mobile }: { userId: string; email: string; mobile: string }) {
  const { update } = useSession();
  const [emailOtp, setEmailOtp] = React.useState("");
  const [mobileOtp, setMobileOtp] = React.useState("");
  const [done, setDone] = React.useState({ email: false, mobile: false });
  const [errors, setErrors] = React.useState({ email: "", mobile: "" });
  const [note, setNote] = React.useState("");
  const [busy, setBusy] = React.useState(false);

  async function post(url: string, body: object) {
    const res = await safeFetch(url, { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify(body) });
    const data = (await res.json().catch(() => ({}))) as { error?: string };
    return { ok: res.ok, error: data.error || "Something went wrong" };
  }

  async function verify(e: React.FormEvent) {
    e.preventDefault();
    setNote("");
    const next = { ...done };
    const errs = { email: "", mobile: "" };
    if (!next.email && emailOtp.length !== 6) errs.email = "Enter the 6-digit code from your email";
    if (!next.mobile && mobileOtp.length !== 6) errs.mobile = "Enter the 6-digit code sent to your mobile";
    if (errs.email || errs.mobile) {
      setErrors(errs);
      return;
    }
    setBusy(true);
    if (!next.email) {
      const r = await post("/api/auth/verify-email", { userId, otp: emailOtp });
      if (r.ok || /already verified/i.test(r.error)) next.email = true;
      else errs.email = friendly(r.error);
    }
    if (!next.mobile) {
      const r = await post("/api/auth/verify-mobile", { otp: mobileOtp });
      if (r.ok || /already verified/i.test(r.error)) next.mobile = true;
      else errs.mobile = friendly(r.error);
    }
    setDone(next);
    setErrors(errs);
    if (next.email && next.mobile) {
      await update().catch(() => undefined); // the middleware reads verification from the session token
      window.location.assign("/vendor/onboarding");
      return;
    }
    setBusy(false);
  }

  async function resend(kind: "email" | "mobile") {
    setNote("");
    const r =
      kind === "email"
        ? await post("/api/auth/send-email-verification", { userId })
        : await post("/api/auth/send-mobile-otp", { mobile });
    setNote(r.ok ? (kind === "email" ? `New code sent to ${email}.` : `New code sent to +91 ${mobile}.`) : r.error);
  }

  return (
    <form onSubmit={verify} noValidate aria-labelledby="verify-title">
      <h2 id="verify-title" className="font-grotesk text-[24px] font-semibold tracking-[-0.02em] text-mx-black">
        Enter your two codes
      </h2>
      <p className="mt-1 text-[14px] leading-relaxed text-[#5b5b63]">Your account is created. Confirm your email and mobile, then add your business details.</p>

      <CodeRow
        icon={<Mail aria-hidden className="size-4" />}
        title="Email code"
        destination={email}
        value={emailOtp}
        onChange={(x) => {
          setEmailOtp(x);
          setErrors((s) => ({ ...s, email: "" }));
        }}
        done={done.email}
        error={errors.email}
        onResend={() => resend("email")}
        autoFocus
      />
      <CodeRow
        icon={<MessageCircle aria-hidden className="size-4" />}
        title="Mobile code (WhatsApp / SMS)"
        destination={`+91 ${mobile}`}
        value={mobileOtp}
        onChange={(x) => {
          setMobileOtp(x);
          setErrors((s) => ({ ...s, mobile: "" }));
        }}
        done={done.mobile}
        error={errors.mobile}
        onResend={() => resend("mobile")}
      />

      {note && (
        <p role="status" className="mt-4 text-[13px] text-[#5b5b63]">
          {note}
        </p>
      )}
      <Button type="submit" size="lg" block loading={busy} disabled={busy} className={`mt-6 ${ctaClass}`}>
        Verify and continue <ArrowRight aria-hidden />
      </Button>
    </form>
  );
}

function CodeRow(props: {
  icon: React.ReactNode;
  title: string;
  destination: string;
  value: string;
  onChange: (v: string) => void;
  done: boolean;
  error: string;
  onResend: () => void;
  autoFocus?: boolean;
}) {
  return (
    <div className="mt-6 border-t border-black/10 pt-5">
      <div className="flex items-baseline justify-between gap-3">
        <p className="flex items-center gap-2 text-[14px] font-semibold text-mx-black">
          {props.icon}
          {props.title}
        </p>
        {props.done ? (
          <span className="flex items-center gap-1 text-[13px] font-semibold text-[#166534]">
            <Check aria-hidden className="size-4" /> Verified
          </span>
        ) : (
          <TextAction type="button" onClick={props.onResend}>
            Resend
          </TextAction>
        )}
      </div>
      <p className="mt-0.5 break-all text-[13px] text-[#6b6b73]">Sent to {props.destination}</p>
      {!props.done && (
        <div className="mt-3">
          <OtpInput value={props.value} onChange={props.onChange} invalid={!!props.error} autoFocus={props.autoFocus} />
          {props.error && (
            <p role="alert" className="mt-2 text-[13px] text-[var(--sig-danger-fg,#b91c1c)]">
              {props.error}
            </p>
          )}
        </div>
      )}
    </div>
  );
}
