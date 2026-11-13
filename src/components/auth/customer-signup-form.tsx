"use client";

import { useEffect, useRef, useState } from "react";
import Link from "next/link";
import { useSearchParams } from "next/navigation";
import { ChevronLeft, LocateFixed, Mail, MessageCircle } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Spinner } from "@/components/ui/spinner";
import { AuthAlert, AuthHeading, SelectField, TextAction, TextField } from "./auth-ui";
import { OtpInput } from "./otp-input";
import { CountdownTimer } from "./countdown-timer";
import { RESEND_COOLDOWN_SECONDS } from "./auth-otp-step";
import { INDIAN_STATES, fieldErrors, signupDetailsSchema, type SignupField } from "@/lib/customer/signup";
import { LocateError, locateAddress } from "@/lib/customer/locate";
import { landingPathForRole, safeCallbackTarget } from "@/lib/auth/safe-redirect";

type Form = Record<SignupField, string>;
type CodeField = "phoneOtp" | "emailOtp";

const EMPTY: Form = { name: "", phone: "", email: "", address: "", city: "", state: "", pincode: "" };

async function post(body: object) {
  const res = await fetch("/api/auth/customer/register", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(body),
  });
  const data = await res.json().catch(() => ({}));
  return { ok: res.ok, status: res.status, data };
}

// New-customer signup (/signup). Step 1 collects who they are and where to
// deliver (typed, or filled from the device location). Step 2 asks for the
// two codes sent to WhatsApp and email; the account only exists, verified and
// signed in, once both are right. Then straight to the catalogue.
export function CustomerSignupForm() {
  const searchParams = useSearchParams();
  const callbackParam = searchParams.get("callbackUrl");
  const loginHref = `/login?as=customer${callbackParam ? `&callbackUrl=${encodeURIComponent(callbackParam)}` : ""}`;

  const [step, setStep] = useState<"details" | "verify">("details");
  const [form, setForm] = useState<Form>(EMPTY);
  const [errors, setErrors] = useState<Partial<Record<SignupField | CodeField, string>>>({});
  const [formError, setFormError] = useState<React.ReactNode>("");
  const [submitting, setSubmitting] = useState(false);

  const [locating, setLocating] = useState(false);
  const [locateNote, setLocateNote] = useState<{ tone: "info" | "danger"; text: string } | null>(null);

  const [sentTo, setSentTo] = useState<{ phone: string; maskedEmail: string } | null>(null);
  const [phoneOtp, setPhoneOtp] = useState("");
  const [emailOtp, setEmailOtp] = useState("");
  const [timerKey, setTimerKey] = useState(0);
  const verifyingRef = useRef(false);

  const set = (field: SignupField) => (e: React.ChangeEvent<HTMLInputElement | HTMLSelectElement>) => {
    const value = field === "pincode" ? e.target.value.replace(/\D/g, "").slice(0, 6) : e.target.value;
    setForm((f) => ({ ...f, [field]: value }));
    if (errors[field]) setErrors((x) => ({ ...x, [field]: undefined }));
    setFormError("");
  };

  async function fillFromLocation() {
    setLocating(true);
    setLocateNote(null);
    try {
      const found = await locateAddress();
      setForm((f) => ({
        ...f,
        address: found.address || f.address,
        city: found.city || f.city,
        state: found.state || f.state,
        pincode: found.pincode || f.pincode,
      }));
      setErrors((x) => ({ ...x, address: undefined, city: undefined, state: undefined, pincode: undefined }));
      setLocateNote({ tone: "info", text: "Filled from your location. Add your house or flat number and check the rest." });
    } catch (err) {
      setLocateNote({ tone: "danger", text: err instanceof LocateError ? err.message : "Couldn't use your location. Enter the address below." });
    } finally {
      setLocating(false);
    }
  }

  async function handleDetails(e: React.FormEvent) {
    e.preventDefault();
    if (submitting) return;
    const parsed = signupDetailsSchema.safeParse(form);
    if (!parsed.success) {
      setErrors(fieldErrors(parsed.error));
      return;
    }
    setSubmitting(true);
    setFormError("");
    try {
      const { ok, data } = await post({ action: "start", ...form });
      if (!ok) {
        if (data.code === "ACCOUNT_EXISTS") {
          setFormError(
            <>
              This mobile number already has an account.{" "}
              <Link href={loginHref} className="font-semibold underline underline-offset-2">Sign in instead</Link>
            </>
          );
        } else {
          setErrors(data.fields ?? {});
          setFormError(data.error || "Couldn't send the codes. Try again.");
        }
        return;
      }
      setSentTo({ phone: data.phone, maskedEmail: data.maskedEmail });
      setPhoneOtp("");
      setEmailOtp("");
      setErrors({});
      setTimerKey((k) => k + 1);
      setFormError(data.emailDelivered === false ? "We couldn't send the email code. Use “Resend” below." : "");
      setStep("verify");
    } catch {
      setFormError("Network error. Check your connection and try again.");
    } finally {
      setSubmitting(false);
    }
  }

  async function verify() {
    if (verifyingRef.current || !sentTo) return;
    verifyingRef.current = true;
    setSubmitting(true);
    setFormError("");
    try {
      const { ok, data } = await post({ action: "verify", phone: sentTo.phone, phoneOtp, emailOtp });
      if (!ok) {
        const fields = (data.fields ?? {}) as Partial<Record<CodeField, string>>;
        setErrors(fields);
        if (fields.phoneOtp) setPhoneOtp("");
        if (fields.emailOtp) setEmailOtp("");
        if (!fields.phoneOtp && !fields.emailOtp) setFormError(data.error || "Couldn't verify. Try again.");
        return;
      }
      window.location.href = safeCallbackTarget(callbackParam, landingPathForRole(data.user?.role));
    } catch {
      setFormError("Network error. Check your connection and try again.");
    } finally {
      verifyingRef.current = false;
      setSubmitting(false);
    }
  }

  async function resend(channel: "phone" | "email") {
    if (!sentTo) return;
    const { ok, data } = await post({ action: "resend", phone: sentTo.phone, channel });
    if (!ok) {
      setFormError(data.error || "Couldn't resend the code.");
      throw new Error("resend failed");
    }
    setErrors((x) => ({ ...x, [channel === "phone" ? "phoneOtp" : "emailOtp"]: undefined }));
    setFormError("");
  }

  // Submit as soon as both codes are complete — no extra tap needed.
  useEffect(() => {
    if (step === "verify" && phoneOtp.length === 6 && emailOtp.length === 6) verify();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [phoneOtp, emailOtp]);

  if (step === "verify" && sentTo) {
    const phoneMasked = `+91 ${sentTo.phone.slice(0, 2)}••• ••${sentTo.phone.slice(-3)}`;
    return (
      <div>
        <AuthHeading
          title="Verify your details"
          subtitle="Enter both codes to create your account. They expire in 5 minutes."
        />

        <div className="space-y-7">
          <CodeBlock
            icon={<MessageCircle size={16} aria-hidden />}
            label="WhatsApp code"
            destination={phoneMasked}
            value={phoneOtp}
            onChange={(v) => { setPhoneOtp(v); setErrors((x) => ({ ...x, phoneOtp: undefined })); }}
            error={errors.phoneOtp}
            disabled={submitting}
            autoFocus
            timerKey={timerKey}
            onResend={() => resend("phone")}
          />
          <CodeBlock
            icon={<Mail size={16} aria-hidden />}
            label="Email code"
            destination={sentTo.maskedEmail}
            hint="Check spam if it isn't in your inbox."
            value={emailOtp}
            onChange={(v) => { setEmailOtp(v); setErrors((x) => ({ ...x, emailOtp: undefined })); }}
            error={errors.emailOtp}
            disabled={submitting}
            timerKey={timerKey}
            onResend={() => resend("email")}
          />

          {formError && <AuthAlert>{formError}</AuthAlert>}

          <Button
            type="button"
            size="lg"
            block
            loading={submitting}
            disabled={phoneOtp.length !== 6 || emailOtp.length !== 6}
            onClick={verify}
          >
            {submitting ? "Verifying..." : "Verify and create account"}
          </Button>

          <TextAction
            onClick={() => { setStep("details"); setErrors({}); setFormError(""); }}
            className="inline-flex items-center gap-1"
          >
            <ChevronLeft size={14} aria-hidden /> Edit details
          </TextAction>
        </div>
      </div>
    );
  }

  return (
    <div>
      <AuthHeading
        title="Create your account"
        subtitle="Takes a minute. We'll confirm your mobile and email with one-time codes."
      />

      <form onSubmit={handleDetails} className="space-y-9" noValidate>
        <fieldset className="space-y-5">
          <legend className="mb-1 font-mono text-12 uppercase tracking-[0.12em] text-[var(--muted)]">01 &nbsp;You</legend>
          <TextField label="Full name" autoComplete="name" placeholder="Rahul Kumar" maxLength={100} autoFocus value={form.name} error={errors.name} onChange={set("name")} />
          <TextField
            label="Mobile number"
            type="tel"
            inputMode="numeric"
            prefix="+91"
            autoComplete="tel-national"
            placeholder="98765 43210"
            value={form.phone}
            error={errors.phone}
            hint="Your sign-in. Codes arrive on WhatsApp."
            onChange={set("phone")}
          />
          <TextField
            label="Email"
            type="email"
            autoComplete="email"
            autoCapitalize="none"
            spellCheck={false}
            placeholder="you@example.com"
            value={form.email}
            error={errors.email}
            hint="For order confirmations and invoices."
            onChange={set("email")}
          />
        </fieldset>

        <fieldset className="space-y-5">
          <div className="mb-1 flex items-center justify-between gap-3">
            <legend className="font-mono text-12 uppercase tracking-[0.12em] text-[var(--muted)]">02 &nbsp;Delivery address</legend>
            <button
              type="button"
              onClick={fillFromLocation}
              disabled={locating}
              className="inline-flex h-9 items-center gap-1.5 rounded-md px-2 -mr-2 text-14 font-medium text-[var(--accent-text)] transition-colors hover:bg-[var(--accent-soft)] focus-visible:outline-2 focus-visible:outline-[var(--focus-ring)] disabled:opacity-60"
            >
              {locating ? <Spinner size={14} /> : <LocateFixed size={15} aria-hidden />}
              {locating ? "Locating..." : "Use current location"}
            </button>
          </div>

          {locateNote && (
            <AuthAlert tone={locateNote.tone} className="py-2.5 text-[13px]">{locateNote.text}</AuthAlert>
          )}

          <TextField
            label="House / flat, street, area"
            autoComplete="street-address"
            placeholder="12B, MG Road, Lajpat Nagar"
            maxLength={300}
            value={form.address}
            error={errors.address}
            onChange={set("address")}
          />
          <div className="grid grid-cols-[minmax(0,2fr)_minmax(0,3fr)] gap-3">
            <TextField
              label="Pincode"
              inputMode="numeric"
              autoComplete="postal-code"
              placeholder="110045"
              mono
              value={form.pincode}
              error={errors.pincode}
              onChange={set("pincode")}
            />
            <TextField label="City" autoComplete="address-level2" placeholder="New Delhi" maxLength={100} value={form.city} error={errors.city} onChange={set("city")} />
          </div>
          <SelectField label="State" autoComplete="address-level1" value={form.state} error={errors.state} onChange={set("state")}>
            <option value="" disabled>Choose state</option>
            {INDIAN_STATES.map((s) => <option key={s} value={s}>{s}</option>)}
          </SelectField>
        </fieldset>

        <div className="space-y-4">
          {formError && <AuthAlert>{formError}</AuthAlert>}
          <Button type="submit" size="lg" block loading={submitting}>
            {submitting ? "Sending codes..." : "Continue"}
          </Button>
          <p className="text-[13px] leading-[1.5] text-[var(--muted)]">
            By continuing you agree to our{" "}
            <Link href="/terms" className="underline underline-offset-2 hover:text-[var(--ink)]">Terms</Link> and{" "}
            <Link href="/privacy" className="underline underline-offset-2 hover:text-[var(--ink)]">Privacy Policy</Link>.
          </p>
        </div>
      </form>

      <p className="mt-8 border-t border-[var(--line)] pt-6 text-14 text-[var(--muted)]">
        Already have an account?{" "}
        <Link href={loginHref} className="font-semibold text-[var(--accent-text)] underline-offset-4 hover:underline">
          Sign in
        </Link>
      </p>
    </div>
  );
}

function CodeBlock(props: {
  icon: React.ReactNode;
  label: string;
  destination: string;
  hint?: string;
  value: string;
  onChange: (v: string) => void;
  error?: string;
  disabled: boolean;
  autoFocus?: boolean;
  timerKey: number;
  onResend: () => Promise<void>;
}) {
  return (
    <section aria-label={props.label}>
      <div className="mb-3 flex items-start justify-between gap-3">
        <div className="min-w-0">
          <p className="flex items-center gap-1.5 text-14 font-semibold text-[var(--ink)]">
            <span className="text-[var(--muted)]">{props.icon}</span>
            {props.label}
          </p>
          <p className="mt-0.5 truncate text-[13px] text-[var(--muted)]">
            Sent to <span className="font-medium text-[var(--ink)]">{props.destination}</span>
          </p>
          {props.hint && <p className="text-[13px] text-[var(--muted)]">{props.hint}</p>}
        </div>
        <div className="shrink-0 pt-0.5">
          <CountdownTimer key={props.timerKey} seconds={RESEND_COOLDOWN_SECONDS} onResend={props.onResend} label="Resend" compact />
        </div>
      </div>
      <OtpInput value={props.value} onChange={props.onChange} disabled={props.disabled} autoFocus={props.autoFocus} invalid={!!props.error} />
      {props.error && (
        <p className="mt-2 text-[13px] font-medium text-[var(--sig-danger-fg)]" role="alert">{props.error}</p>
      )}
    </section>
  );
}

