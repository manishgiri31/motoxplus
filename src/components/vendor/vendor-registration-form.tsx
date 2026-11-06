"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { CheckCircle } from "lucide-react";
import { Field, FormGrid, Input, Select, Textarea } from "@/components/ui/field";
import { PartCategoryPicker } from "@/components/catalog/part-category-picker";
import { VehicleSegmentPicker } from "@/components/catalog/vehicle-segment-picker";
import { cn } from "@/lib/utils";

const INDIAN_STATES = [
  "Andhra Pradesh", "Arunachal Pradesh", "Assam", "Bihar", "Chhattisgarh",
  "Goa", "Gujarat", "Haryana", "Himachal Pradesh", "Jharkhand", "Karnataka",
  "Kerala", "Madhya Pradesh", "Maharashtra", "Manipur", "Meghalaya", "Mizoram",
  "Nagaland", "Odisha", "Punjab", "Rajasthan", "Sikkim", "Tamil Nadu",
  "Telangana", "Tripura", "Uttar Pradesh", "Uttarakhand", "West Bengal",
  "Delhi", "Chandigarh", "Puducherry",
];

type TextField =
  | "companyName" | "ownerName" | "email" | "phone" | "password" | "confirmPassword"
  | "gstNumber" | "panNumber" | "aadhaarNumber" | "state" | "city"
  | "companyAddress" | "shopAddress" | "pincode" | "website" | "notes";

/**
 * Procurement vendor application (POST /api/vendor/register). Wrapped in `mx-seller`, so every shared
 * control uses the MotoXPlus red/black system.
 */
export function VendorRegistrationForm() {
  const router = useRouter();
  const [form, setForm] = useState<Record<TextField, string>>({
    companyName: "", ownerName: "", email: "", phone: "", password: "", confirmPassword: "",
    gstNumber: "", panNumber: "", aadhaarNumber: "", state: "", city: "",
    companyAddress: "", shopAddress: "", pincode: "", website: "", notes: "",
  });
  const [categoryIds, setCategoryIds] = useState<string[]>([]);
  const [vehicleSegments, setVehicleSegments] = useState<string[]>([]);
  const [fieldErrors, setFieldErrors] = useState<Partial<Record<"categoryIds" | "vehicleSegments" | "confirmPassword", string>>>({});
  const [status, setStatus] = useState<"idle" | "loading" | "success" | "error">("idle");
  const [errorMsg, setErrorMsg] = useState("");
  const [userId, setUserId] = useState("");

  function set(field: TextField, value: string) {
    setForm((prev) => ({ ...prev, [field]: value }));
  }

  function focusFirstInvalid(field: string) {
    requestAnimationFrame(() => document.getElementById(field)?.focus());
  }

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    setErrorMsg("");
    const errs: typeof fieldErrors = {};
    if (form.password !== form.confirmPassword) errs.confirmPassword = "Passwords do not match";
    if (categoryIds.length === 0) errs.categoryIds = "Select at least one category you manufacture or supply";
    if (vehicleSegments.length === 0) errs.vehicleSegments = "Select at least one vehicle segment";
    setFieldErrors(errs);
    if (Object.keys(errs).length) {
      const first = errs.confirmPassword ? "confirmPassword" : errs.categoryIds ? "partCategories" : "vehicleSegments-motorcycle";
      focusFirstInvalid(first);
      return;
    }

    setStatus("loading");
    try {
      const body: Record<string, unknown> = {
        companyName: form.companyName,
        ownerName: form.ownerName,
        email: form.email,
        phone: form.phone,
        password: form.password,
        categoryIds,
        vehicleSegments,
        state: form.state,
        city: form.city,
      };
      if (form.companyAddress) body.companyAddress = form.companyAddress;
      if (form.shopAddress) body.shopAddress = form.shopAddress;
      if (form.pincode) body.pincode = form.pincode;
      if (form.gstNumber) body.gstNumber = form.gstNumber.toUpperCase();
      if (form.panNumber) body.panNumber = form.panNumber.toUpperCase();
      if (form.aadhaarNumber) body.aadhaarNumber = form.aadhaarNumber;
      if (form.website) body.website = form.website;
      if (form.notes) body.notes = form.notes;

      const res = await fetch("/api/vendor/register", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(body),
      });
      const data = await res.json();
      if (!res.ok) {
        if (data.field === "categoryIds") {
          setFieldErrors({ categoryIds: data.error });
          focusFirstInvalid("partCategories");
          setStatus("idle");
          return;
        }
        setErrorMsg(data.error || "Registration failed");
        setStatus("error");
        return;
      }
      setUserId(data.userId);
      setStatus("success");
    } catch {
      setErrorMsg("Something went wrong. Please try again.");
      setStatus("error");
    }
  }

  if (status === "success") {
    return (
      <div className="mx-seller border border-mx-black bg-white p-8 sm:p-12">
        <CheckCircle aria-hidden size={32} className="mb-6 text-mx-red" />
        <h2 className="text-2xl font-bold tracking-tight text-mx-black">Application submitted</h2>
        <p className="mt-3 leading-relaxed text-[var(--text-secondary)]">
          We&apos;ve sent a verification code to <span className="font-medium text-mx-black">{form.email}</span>. Verify your email to continue.
        </p>
        <ol className="mt-8 border-t border-black/10">
          {[
            "Verify your email address",
            "Verify your mobile number",
            "Our procurement team reviews your application",
            "Once approved, list products under your approved categories",
          ].map((step, i) => (
            <li key={step} className="flex items-baseline gap-4 border-b border-black/10 py-3">
              <span className="w-5 font-mono text-sm font-semibold text-mx-red tabular-nums">{i + 1}</span>
              <span className="text-sm text-[var(--text-primary)]">{step}</span>
            </li>
          ))}
        </ol>
        <button
          onClick={() => router.push(`/verify-email?userId=${userId}`)}
          className="mt-8 h-12 bg-mx-red px-8 text-sm font-semibold text-white transition-colors hover:bg-mx-red-deep focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-mx-black"
        >
          Verify email
        </button>
      </div>
    );
  }

  return (
    <div className="mx-seller border border-black/15 bg-white">
      <div className="border-b border-black/10 px-6 py-6 sm:px-8">
        <h2 className="text-2xl font-bold tracking-tight text-mx-black">Vendor application</h2>
        <p className="mt-1 text-sm text-[var(--text-muted)]">Takes about five minutes. Fields marked * are required.</p>
      </div>

      <form onSubmit={handleSubmit} className="px-6 sm:px-8">
        <Section title="Business & contact">
          <FormGrid>
            <Field label="Company name" name="companyName" required span={2}>
              <Input required value={form.companyName} onChange={(e) => set("companyName", e.target.value)} placeholder="Your business / company name" />
            </Field>
            <Field label="Owner / contact name" name="ownerName" required>
              <Input required value={form.ownerName} onChange={(e) => set("ownerName", e.target.value)} placeholder="Full name" autoComplete="name" />
            </Field>
            <Field label="Phone" name="phone" required>
              <Input required type="tel" value={form.phone} onChange={(e) => set("phone", e.target.value)} placeholder="+91 98765 43210" autoComplete="tel" />
            </Field>
            <Field label="Email" name="email" required span={2}>
              <Input required type="email" value={form.email} onChange={(e) => set("email", e.target.value)} placeholder="business@company.com" autoComplete="email" />
            </Field>
            <Field label="Password" name="password" required hint="At least 8 characters">
              <Input required type="password" minLength={8} value={form.password} onChange={(e) => set("password", e.target.value)} autoComplete="new-password" />
            </Field>
            <Field label="Confirm password" name="confirmPassword" required error={fieldErrors.confirmPassword}>
              <Input required type="password" minLength={8} value={form.confirmPassword} onChange={(e) => set("confirmPassword", e.target.value)} autoComplete="new-password" />
            </Field>
          </FormGrid>
        </Section>

        <Section
          title="What you supply"
          description="Choose whole groups or individual part types. These define what you can list after approval — you add individual products later."
        >
          <div className="grid gap-6">
            <PartCategoryPicker
              value={categoryIds}
              onChange={(v) => {
                setCategoryIds(v);
                if (v.length) setFieldErrors((f) => ({ ...f, categoryIds: undefined }));
              }}
              error={fieldErrors.categoryIds}
              required
            />
            <VehicleSegmentPicker
              value={vehicleSegments}
              onChange={(v) => {
                setVehicleSegments(v);
                if (v.length) setFieldErrors((f) => ({ ...f, vehicleSegments: undefined }));
              }}
              error={fieldErrors.vehicleSegments}
              required
            />
            <Field label="Anything else we should know?" name="notes" hint="Optional. Capacity, brands you make for, years in business…">
              <Textarea rows={3} value={form.notes} onChange={(e) => set("notes", e.target.value)} />
            </Field>
          </div>
        </Section>

        <Section title="Location">
          <FormGrid>
            <Field label="State" name="state" required>
              <Select required value={form.state} onChange={(e) => set("state", e.target.value)}>
                <option value="">Select state</option>
                {INDIAN_STATES.map((s) => <option key={s} value={s}>{s}</option>)}
              </Select>
            </Field>
            <Field label="City" name="city" required>
              <Input required value={form.city} onChange={(e) => set("city", e.target.value)} autoComplete="address-level2" />
            </Field>
            <Field label="Company address" name="companyAddress">
              <Input value={form.companyAddress} onChange={(e) => set("companyAddress", e.target.value)} placeholder="Registered address" />
            </Field>
            <Field label="Shop / warehouse address" name="shopAddress">
              <Input value={form.shopAddress} onChange={(e) => set("shopAddress", e.target.value)} />
            </Field>
            <Field label="Pincode" name="pincode">
              <Input inputMode="numeric" pattern="[0-9]{6}" maxLength={6} value={form.pincode} onChange={(e) => set("pincode", e.target.value.replace(/\D/g, ""))} placeholder="000000" />
            </Field>
            <Field label="Website" name="website">
              <Input type="url" value={form.website} onChange={(e) => set("website", e.target.value)} placeholder="https://" />
            </Field>
          </FormGrid>
        </Section>

        <Section title="Tax & identity" description="Optional now; speeds up approval.">
          <FormGrid columns={3}>
            <Field label="GST number" name="gstNumber">
              <Input className="font-mono" value={form.gstNumber} onChange={(e) => set("gstNumber", e.target.value.toUpperCase())} placeholder="22AAAAA0000A1Z5" maxLength={15} />
            </Field>
            <Field label="PAN" name="panNumber">
              <Input className="font-mono" value={form.panNumber} onChange={(e) => set("panNumber", e.target.value.toUpperCase())} placeholder="AAAAA0000A" maxLength={10} />
            </Field>
            <Field label="Aadhaar" name="aadhaarNumber" hint="Stored encrypted">
              <Input className="font-mono" inputMode="numeric" value={form.aadhaarNumber} onChange={(e) => set("aadhaarNumber", e.target.value.replace(/\D/g, ""))} maxLength={12} />
            </Field>
          </FormGrid>
        </Section>

        <div className="py-6">
          {status === "error" && (
            <div role="alert" className="mb-4 border border-[var(--sig-danger-bd)] bg-[var(--sig-danger-bg)] px-4 py-3 text-sm text-[var(--sig-danger-fg)]">
              {errorMsg}
            </div>
          )}
          <button
            type="submit"
            disabled={status === "loading"}
            className={cn(
              "h-12 w-full bg-mx-red text-sm font-semibold text-white transition-colors hover:bg-mx-red-deep",
              "focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-mx-black disabled:opacity-50"
            )}
          >
            {status === "loading" ? "Submitting application…" : "Submit vendor application"}
          </button>
          <p className="mt-3 text-center text-xs text-[var(--text-muted)]">
            By submitting, you agree to our vendor terms. Applications are reviewed within 3 business days.
          </p>
        </div>
      </form>
    </div>
  );
}

function Section({ title, description, children }: { title: string; description?: string; children: React.ReactNode }) {
  return (
    <section className="border-b border-black/10 py-6">
      <h3 className="text-[13px] font-semibold uppercase tracking-[0.08em] text-mx-black">{title}</h3>
      {description && <p className="mt-1 max-w-prose text-xs leading-relaxed text-[var(--text-muted)]">{description}</p>}
      <div className="mt-4">{children}</div>
    </section>
  );
}
