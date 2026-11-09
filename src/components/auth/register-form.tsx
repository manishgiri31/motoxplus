"use client";

import { useRef, useState } from "react";
import Link from "next/link";
import { ArrowLeft, MailCheck } from "lucide-react";
import { Button } from "@/components/ui/button";
import { AuthAlert, AuthHeading, PasswordField, SelectField, TextAction, TextField } from "./auth-ui";
import { evaluatePassword, PASSWORD_MAX_BYTES } from "@/lib/auth/password-policy";
import { normalizeIndianMobile } from "@/lib/phone";
import { isWellFormedGstin } from "@/lib/gst/gstin";

const INDIAN_STATES = [
  "Andhra Pradesh","Arunachal Pradesh","Assam","Bihar","Chhattisgarh","Delhi","Goa","Gujarat",
  "Haryana","Himachal Pradesh","Jharkhand","Karnataka","Kerala","Madhya Pradesh","Maharashtra",
  "Manipur","Meghalaya","Mizoram","Nagaland","Odisha","Punjab","Rajasthan","Sikkim","Tamil Nadu",
  "Telangana","Tripura","Uttar Pradesh","Uttarakhand","West Bengal",
];

const PAN_REGEX = /^[A-Z]{5}[0-9]{4}[A-Z]{1}$/;
const EMAIL_REGEX = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;

type Errors = Partial<Record<string, string>>;

// Which step a server-side rejection belongs to, so a 409 "Email already
// registered" sent back from step 2's submit lands on the email field instead
// of a banner about a field the user can no longer see.
const ACCOUNT_FIELDS = new Set(["name", "email", "phone", "password"]);

function mapServerError(message: string): { field: string; message: string } | null {
  if (/^email|invalid email/i.test(message)) return { field: "email", message };
  if (/mobile/i.test(message)) return { field: "phone", message };
  if (/password/i.test(message)) return { field: "password", message };
  if (/gst/i.test(message)) return { field: "gstNumber", message };
  if (/pan/i.test(message)) return { field: "panNumber", message };
  if (/aadhaar/i.test(message)) return { field: "aadhaarNumber", message };
  if (/pincode/i.test(message)) return { field: "pincode", message };
  return null;
}

// Dealer signup. Two short steps (account → business), validated per step with
// the same rules the server enforces (src/lib/auth/password-policy.ts is the
// shared source for the password rules). The old form had a "confirm
// password" box and a bare 8-character minimum; it now shows the policy as the
// user types and relies on the show/hide toggle instead of making people type
// a secret twice blind.
export function RegisterForm() {
  const [step, setStep] = useState<1 | 2>(1);
  const [a, setA] = useState({ name: "", email: "", phone: "", password: "" });
  const [b, setB] = useState({ companyName: "", ownerName: "", gstNumber: "", panNumber: "", aadhaarNumber: "", address: "", state: "", city: "", pincode: "" });
  const [errors, setErrors] = useState<Errors>({});
  const [status, setStatus] = useState<"idle" | "loading" | "success">("idle");
  const [formError, setFormError] = useState("");
  const [created, setCreated] = useState<{ userId: string; email: string } | null>(null);
  const formRef = useRef<HTMLFormElement>(null);

  function setField<K extends keyof typeof a>(k: K, v: string) {
    setA((p) => ({ ...p, [k]: v }));
    setErrors((p) => ({ ...p, [k]: undefined }));
    setFormError("");
  }
  function setBField<K extends keyof typeof b>(k: K, v: string) {
    setB((p) => ({ ...p, [k]: v }));
    setErrors((p) => ({ ...p, [k]: undefined }));
    setFormError("");
  }

  function focusFirstError(errs: Errors) {
    const first = Object.keys(errs).find((k) => errs[k]);
    if (first) requestAnimationFrame(() => formRef.current?.querySelector<HTMLElement>(`[name="${first}"]`)?.focus());
  }

  function validateAccount(): Errors {
    const e: Errors = {};
    if (a.name.trim().length < 2) e.name = "Enter your full name";
    if (!EMAIL_REGEX.test(a.email.trim())) e.email = "Enter a valid email address";
    if (!normalizeIndianMobile(a.phone)) e.phone = "Enter a valid 10-digit mobile number";
    if (!a.password) e.password = "Create a password";
    else if (new TextEncoder().encode(a.password).length > PASSWORD_MAX_BYTES) e.password = `Use ${PASSWORD_MAX_BYTES} bytes or fewer`;
    else if (!evaluatePassword(a.password).meetsRules) e.password = "Password doesn't meet all the requirements below";
    return e;
  }

  function validateBusiness(): Errors {
    const e: Errors = {};
    if (!b.companyName.trim()) e.companyName = "Enter your company or shop name";
    if (!b.ownerName.trim()) e.ownerName = "Enter the proprietor or director's name";
    // Dealer = B2B account: GSTIN required (the server also checks it live
    // against the GST registry). Retail buyers sign up as a Customer instead.
    if (!b.gstNumber) e.gstNumber = "GSTIN is required for a dealer account";
    else if (!isWellFormedGstin(b.gstNumber)) e.gstNumber = "Enter a valid 15-character GSTIN";
    if (b.panNumber && !PAN_REGEX.test(b.panNumber)) e.panNumber = "Enter a valid PAN, e.g. ABCDE1234F";
    if (b.aadhaarNumber && b.aadhaarNumber.length !== 12) e.aadhaarNumber = "Aadhaar is 12 digits";
    if (!b.address.trim()) e.address = "Enter your shop or office address";
    if (!b.state) e.state = "Select a state";
    if (!b.city.trim()) e.city = "Enter your city";
    if (!/^[1-9][0-9]{5}$/.test(b.pincode)) e.pincode = "Enter a 6-digit pincode";
    return e;
  }

  function handleStep1(e: React.FormEvent) {
    e.preventDefault();
    const errs = validateAccount();
    setErrors(errs);
    if (Object.keys(errs).length) return focusFirstError(errs);
    setStep(2);
    window.scrollTo({ top: 0 });
  }

  async function handleStep2(e: React.FormEvent) {
    e.preventDefault();
    if (status === "loading") return;
    const errs = validateBusiness();
    setErrors(errs);
    if (Object.keys(errs).length) return focusFirstError(errs);

    setStatus("loading");
    setFormError("");
    let res: Response;
    try {
      res = await fetch("/api/auth/register", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ ...a, ...b }),
      });
    } catch {
      setFormError("Network error. Check your connection and try again.");
      setStatus("idle");
      return;
    }
    const data = await res.json().catch(() => ({}));
    if (!res.ok) {
      setStatus("idle");
      const message: string = data.error || (res.status === 429 ? "Too many attempts. Please try again later." : "Registration failed. Please try again.");
      const mapped = res.status === 429 ? null : mapServerError(message);
      if (mapped) {
        const errs2 = { [mapped.field]: mapped.message };
        setErrors(errs2);
        if (ACCOUNT_FIELDS.has(mapped.field)) setStep(1);
        focusFirstError(errs2);
      } else {
        setFormError(message);
      }
      return;
    }
    setCreated({ userId: data.userId, email: data.email ?? a.email });
    setStatus("success");
    window.scrollTo({ top: 0 });
  }

  if (status === "success" && created) {
    return (
      <div>
        <div className="mb-6 grid h-12 w-12 place-items-center rounded-lg bg-[var(--sig-ok-bg)] text-[var(--sig-ok-fg)]">
          <MailCheck size={22} aria-hidden />
        </div>
        <AuthHeading
          title="Check your email"
          subtitle={
            <>
              We sent a 6-digit verification code to <span className="font-semibold text-[var(--ink)]">{created.email}</span>.
            </>
          }
        />
        <ol className="mb-8 space-y-3 border-t border-[var(--line)] pt-5 text-[15px]">
          <li className="flex gap-3"><span className="font-mono text-12 pt-0.5 text-[var(--muted)]">01</span><span className="text-[var(--ink)]">Enter the code to verify your email</span></li>
          <li className="flex gap-3"><span className="font-mono text-12 pt-0.5 text-[var(--muted)]">02</span><span className="text-[var(--muted)]">Sign in, then verify your mobile number</span></li>
          <li className="flex gap-3"><span className="font-mono text-12 pt-0.5 text-[var(--muted)]">03</span><span className="text-[var(--muted)]">Start ordering</span></li>
        </ol>
        <Button asChild size="lg" block>
          <Link href={`/verify-email?userId=${encodeURIComponent(created.userId)}`}>Enter verification code</Link>
        </Button>
      </div>
    );
  }

  const busy = status === "loading";

  return (
    <div>
      <div className="mb-8">
        <p className="mb-2.5 font-mono text-12 uppercase tracking-[0.12em] text-[var(--muted)]">
          Step {step} of 2 <span aria-hidden>/</span> {step === 1 ? "Account" : "Business"}
        </p>
        <div className="grid grid-cols-2 gap-1.5" aria-hidden>
          <span className="h-0.5 rounded-full bg-[var(--ink)]" />
          <span className={`h-0.5 rounded-full transition-colors duration-[var(--dur-2)] ${step === 2 ? "bg-[var(--ink)]" : "bg-[var(--line)]"}`} />
        </div>
      </div>

      {step === 1 && (
        <form ref={formRef} onSubmit={handleStep1} className="space-y-5" noValidate>
          <AuthHeading title="Create your dealer account" subtitle="You'll use these details to sign in. Business details come next." />
          <TextField label="Full name" name="name" autoComplete="name" autoFocus maxLength={100} value={a.name} error={errors.name} placeholder="Your full name" onChange={(e) => setField("name", e.target.value)} />
          <TextField label="Work email" name="email" type="email" autoComplete="email" autoCapitalize="none" spellCheck={false} maxLength={254} value={a.email} error={errors.email} placeholder="you@company.com" onChange={(e) => setField("email", e.target.value)} />
          <TextField label="Mobile number" name="phone" type="tel" inputMode="numeric" autoComplete="tel-national" prefix="+91" value={a.phone} error={errors.phone} placeholder="98765 43210" hint="We'll verify this number with a one-time code." onChange={(e) => setField("phone", e.target.value)} />
          <PasswordField label="Password" name="password" autoComplete="new-password" showStrength value={a.password} error={errors.password} placeholder="Create a password" onChange={(e) => setField("password", e.target.value)} />
          <Button type="submit" size="lg" block>
            Continue
          </Button>
        </form>
      )}

      {step === 2 && (
        <form ref={formRef} onSubmit={handleStep2} className="space-y-5" noValidate>
          <AuthHeading title="Tell us about your business" subtitle="Used to set up your dealer pricing and GST invoices." />
          <TextField label="Company or shop name" name="companyName" autoComplete="organization" autoFocus maxLength={150} value={b.companyName} error={errors.companyName} onChange={(e) => setBField("companyName", e.target.value)} />
          <TextField label="Proprietor / director" name="ownerName" autoComplete="off" maxLength={100} value={b.ownerName} error={errors.ownerName} placeholder="Name as on business records" onChange={(e) => setBField("ownerName", e.target.value)} />

          <fieldset className="space-y-4 rounded-lg border border-[var(--line)] p-4">
            <legend className="px-1.5 text-14 font-medium text-[var(--ink)]">
              Tax identity <span className="font-normal text-[var(--muted)]">(optional)</span>
            </legend>
            <TextField label="GSTIN" name="gstNumber" mono autoComplete="off" autoCapitalize="characters" spellCheck={false} maxLength={15} value={b.gstNumber} error={errors.gstNumber} placeholder="22AAAAA0000A1Z5" onChange={(e) => setBField("gstNumber", e.target.value.toUpperCase().replace(/\s/g, ""))} />
            <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
              <TextField label="PAN" name="panNumber" mono autoComplete="off" autoCapitalize="characters" spellCheck={false} maxLength={10} value={b.panNumber} error={errors.panNumber} placeholder="ABCDE1234F" onChange={(e) => setBField("panNumber", e.target.value.toUpperCase().replace(/\s/g, ""))} />
              <TextField label="Aadhaar" name="aadhaarNumber" mono inputMode="numeric" autoComplete="off" maxLength={12} value={b.aadhaarNumber} error={errors.aadhaarNumber} placeholder="12 digits" onChange={(e) => setBField("aadhaarNumber", e.target.value.replace(/\D/g, ""))} />
            </div>
            <p className="text-[13px] leading-[1.5] text-[var(--muted)]">Aadhaar is encrypted before it is stored.</p>
          </fieldset>

          <TextField label="Shop / office address" name="address" autoComplete="street-address" maxLength={300} value={b.address} error={errors.address} onChange={(e) => setBField("address", e.target.value)} />
          <div className="grid grid-cols-1 gap-5 sm:grid-cols-2">
            <SelectField label="State" name="state" autoComplete="address-level1" value={b.state} error={errors.state} onChange={(e) => setBField("state", e.target.value)}>
              <option value="">Select state</option>
              {INDIAN_STATES.map((st) => <option key={st} value={st}>{st}</option>)}
            </SelectField>
            <TextField label="City" name="city" autoComplete="address-level2" maxLength={80} value={b.city} error={errors.city} onChange={(e) => setBField("city", e.target.value)} />
          </div>
          <div className="sm:w-1/2 sm:pr-2.5">
            <TextField label="Pincode" name="pincode" mono inputMode="numeric" autoComplete="postal-code" maxLength={6} value={b.pincode} error={errors.pincode} placeholder="6 digits" onChange={(e) => setBField("pincode", e.target.value.replace(/\D/g, ""))} />
          </div>

          {formError && <AuthAlert>{formError}</AuthAlert>}

          <Button type="submit" size="lg" block loading={busy}>
            {busy ? "Creating account..." : "Create account"}
          </Button>
          <p className="text-[13px] leading-[1.5] text-[var(--muted)]">
            By creating an account you agree to our{" "}
            <Link href="/terms" className="underline underline-offset-2 hover:text-[var(--ink)]">Terms</Link> and{" "}
            <Link href="/privacy" className="underline underline-offset-2 hover:text-[var(--ink)]">Privacy Policy</Link>.
          </p>
          <TextAction onClick={() => { setStep(1); setFormError(""); window.scrollTo({ top: 0 }); }} className="inline-flex items-center gap-1">
            <ArrowLeft size={14} aria-hidden /> Back to account details
          </TextAction>
        </form>
      )}

      <p className="mt-10 border-t border-[var(--line)] pt-6 text-14 text-[var(--muted)]">
        Already registered?{" "}
        <Link href="/login" className="font-semibold text-[var(--accent-text)] underline-offset-4 hover:underline">
          Sign in
        </Link>
      </p>
    </div>
  );
}
