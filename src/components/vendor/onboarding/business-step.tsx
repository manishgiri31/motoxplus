"use client";

import * as React from "react";
import { useRouter } from "next/navigation";
import { Field, FormGrid, Input, Select, Textarea } from "@/components/ui/field";
import { BUSINESS_TYPES, INDIAN_STATES, businessSchema } from "@/lib/seller/registration";
import { saveBusiness, type VendorApplication } from "@/lib/vendor/onboarding";
import { errorsFrom, useApplication } from "./application-context";
import { Banner, StepActions, StepPage } from "./step-page";

type Values = { businessName: string; businessType: string; pan: string; gstin: string; address: string; state: string; city: string; pincode: string };

function initial(app: VendorApplication): Values {
  const b = app.business;
  return {
    businessName: b?.businessName ?? app.account.businessName ?? "",
    businessType: b?.businessType ?? "",
    pan: b?.pan ?? "",
    gstin: b?.gstin ?? "",
    address: b?.address ?? "",
    state: b?.state ?? "",
    city: b?.city ?? "",
    pincode: b?.pincode ?? "",
  };
}

export function BusinessStep() {
  return (
    <StepPage
      title="Business details"
      description="The legal business that will sell on MotoXPlus. We check these against your PAN, GST and registration documents."
      backHref="/vendor/onboarding"
    >
      {(app) => <BusinessForm app={app} />}
    </StepPage>
  );
}

function BusinessForm({ app }: { app: VendorApplication }) {
  const router = useRouter();
  const { set } = useApplication();
  const [v, setV] = React.useState<Values>(() => initial(app));
  const [errors, setErrors] = React.useState<Record<string, string>>({});
  const [banner, setBanner] = React.useState("");
  const [busy, setBusy] = React.useState(false);
  const formRef = React.useRef<HTMLFormElement>(null);
  const locked = !app.editable;

  const on = (k: keyof Values) => (e: React.ChangeEvent<HTMLInputElement | HTMLSelectElement | HTMLTextAreaElement>) => {
    const value = k === "pan" || k === "gstin" ? e.target.value.toUpperCase() : e.target.value;
    setV((s) => ({ ...s, [k]: value }));
    setErrors((er) => ({ ...er, [k]: "" }));
  };

  function focusFirstError() {
    requestAnimationFrame(() => formRef.current?.querySelector<HTMLElement>("[aria-invalid='true']")?.focus());
  }

  async function submit(e: React.FormEvent) {
    e.preventDefault();
    setBanner("");
    const parsed = businessSchema.safeParse(v);
    if (!parsed.success) {
      const errs: Record<string, string> = {};
      for (const issue of parsed.error.issues) {
        const key = String(issue.path[0]);
        if (!errs[key]) errs[key] = issue.message;
      }
      setErrors(errs);
      focusFirstError();
      return;
    }
    setBusy(true);
    try {
      const next = await saveBusiness({ ...v, pan: v.pan.trim(), gstin: v.gstin.trim() });
      set(next);
      router.push("/vendor/onboarding/categories");
    } catch (err) {
      const { fields, message } = errorsFrom(err);
      setErrors(fields);
      setBanner(message);
      focusFirstError();
    } finally {
      setBusy(false);
    }
  }

  return (
    <form ref={formRef} onSubmit={submit} noValidate>
      <fieldset disabled={locked || busy} className="min-w-0">
        {banner && (
          <div className="mb-6">
            <Banner tone="error">{banner}</Banner>
          </div>
        )}
        <FormGrid columns={2}>
          <Field label="Business or company name" name="businessName" required error={errors.businessName} span={2}>
            <Input value={v.businessName} onChange={on("businessName")} autoComplete="organization" maxLength={150} />
          </Field>
          <Field label="Business type" name="businessType" required error={errors.businessType}>
            <Select value={v.businessType} onChange={on("businessType")}>
              <option value="">Select</option>
              {BUSINESS_TYPES.map((t) => (
                <option key={t.value} value={t.value}>
                  {t.label}
                </option>
              ))}
            </Select>
          </Field>
          <Field label="Business PAN" name="pan" required error={errors.pan} hint="10 characters, e.g. ABCDE1234F">
            <Input value={v.pan} onChange={on("pan")} maxLength={10} autoCapitalize="characters" spellCheck={false} className="font-mono uppercase" />
          </Field>
          <Field label="GSTIN" name="gstin" error={errors.gstin} hint="Leave empty only if your business is not GST-registered" span={2}>
            <Input value={v.gstin} onChange={on("gstin")} maxLength={15} autoCapitalize="characters" spellCheck={false} className="font-mono uppercase" />
          </Field>
          <Field label="Registered business address" name="address" required error={errors.address} span={2}>
            <Textarea value={v.address} onChange={on("address")} rows={3} maxLength={300} autoComplete="street-address" />
          </Field>
          <Field label="State" name="state" required error={errors.state}>
            <Select value={v.state} onChange={on("state")}>
              <option value="">Select</option>
              {INDIAN_STATES.map((s) => (
                <option key={s} value={s}>
                  {s}
                </option>
              ))}
            </Select>
          </Field>
          <Field label="City" name="city" required error={errors.city}>
            <Input value={v.city} onChange={on("city")} autoComplete="address-level2" maxLength={80} />
          </Field>
          <Field label="Pincode" name="pincode" required error={errors.pincode}>
            <Input value={v.pincode} onChange={on("pincode")} inputMode="numeric" maxLength={6} autoComplete="postal-code" className="font-mono" />
          </Field>
        </FormGrid>
      </fieldset>
      {!locked && <StepActions backHref="/vendor/onboarding" busy={busy} />}
    </form>
  );
}
