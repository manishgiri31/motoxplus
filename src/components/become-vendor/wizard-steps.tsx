"use client";

import { Pencil } from "lucide-react";
import { Checkbox, Field, FieldError, FormGrid, Input, Select, Textarea } from "@/components/ui/field";
import { evaluatePassword } from "@/lib/auth/password-policy";
import {
  BUSINESS_TYPES,
  INDIAN_STATES,
  SKU_RANGES,
  VEHICLE_BRANDS,
  maskAccountNumber,
  type DocKey,
  type FieldErrors,
  type RegistrationDraft,
  type StepId,
} from "@/lib/seller/registration";
import { SELLER_AGREEMENT_URL } from "@/lib/seller/config";
import { cn } from "@/lib/utils";
import { CheckGroup, FileField, PasswordInput } from "./wizard-controls";
import { PartCategoryPicker } from "@/components/catalog/part-category-picker";
import { VehicleSegmentPicker } from "@/components/catalog/vehicle-segment-picker";
import { usePartCategoryTree } from "@/components/catalog/use-part-category-tree";
import { selectionChips } from "@/lib/catalog/part-category-selection";
import { vehicleSegmentLabel } from "@/lib/catalog/vehicle-segments";

export interface StepProps {
  draft: RegistrationDraft;
  errors: FieldErrors;
  set: <K extends keyof RegistrationDraft>(key: K, value: RegistrationDraft[K]) => void;
  disabled: boolean;
}

const digits = (v: string, max: number) => v.replace(/\D/g, "").slice(0, max);

function StepTitle({ title, note }: { title: string; note?: string }) {
  return (
    <div className="mb-6">
      <h3 data-step-title className="scroll-mt-28 font-grotesk text-[24px] font-semibold tracking-[-0.02em] text-mx-black outline-none">{title}</h3>
      {note && <p className="mt-1.5 max-w-[60ch] text-[15px] leading-relaxed text-[#4b4b52]">{note}</p>}
    </div>
  );
}

// ───────────────────────── 1 · account ─────────────────────────

export function AccountStep({ draft, errors, set, disabled }: StepProps) {
  const pw = evaluatePassword(draft.password);
  return (
    <>
      <StepTitle
        title="Create your seller account"
        note="After you submit, we send a code to your email and one to your mobile. You verify both before your application is reviewed."
      />
      <FormGrid>
        <Field label="Full name" name="fullName" required error={errors.fullName}>
          <Input value={draft.fullName} disabled={disabled} autoComplete="name" maxLength={100} onChange={(e) => set("fullName", e.target.value)} />
        </Field>
        <Field label="Mobile number" name="mobile" required error={errors.mobile} hint="10-digit Indian mobile. We send an OTP here.">
          <Input type="tel" inputMode="tel" value={draft.mobile} disabled={disabled} autoComplete="tel" maxLength={16} onChange={(e) => set("mobile", e.target.value)} />
        </Field>
        <Field label="Email address" name="email" required error={errors.email} span={2}>
          <Input type="email" value={draft.email} disabled={disabled} autoComplete="email" maxLength={254} onChange={(e) => set("email", e.target.value)} />
        </Field>
        <Field label="Password" name="password" required error={errors.password}>
          <PasswordInput value={draft.password} disabled={disabled} autoComplete="new-password" maxLength={72} onChange={(e) => set("password", e.target.value)} />
        </Field>
        <Field label="Confirm password" name="confirmPassword" required error={errors.confirmPassword}>
          <PasswordInput value={draft.confirmPassword} disabled={disabled} autoComplete="new-password" maxLength={72} onChange={(e) => set("confirmPassword", e.target.value)} />
        </Field>
      </FormGrid>
      {draft.password && (
        <ul aria-label="Password requirements" className="mt-4 grid gap-1 text-[13px] sm:grid-cols-2">
          {pw.rules.map((r) => (
            <li key={r.id} className={cn("flex items-center gap-2", r.met ? "text-[#166534]" : "text-[#6b6b73]")}>
              <span aria-hidden className={cn("size-1.5", r.met ? "bg-[#166534]" : "bg-mx-silver")} />
              {r.label}
              <span className="sr-only">{r.met ? " (met)" : " (not met yet)"}</span>
            </li>
          ))}
        </ul>
      )}
    </>
  );
}

// ───────────────────────── 2 · business ─────────────────────────

export function BusinessStep({ draft, errors, set, disabled }: StepProps) {
  return (
    <>
      <StepTitle title="Tell us about your business" note="Used for KYC. PAN and GSTIN are never shown publicly." />
      <FormGrid>
        <Field label="Business / company name" name="businessName" required error={errors.businessName} span={2}>
          <Input value={draft.businessName} disabled={disabled} autoComplete="organization" maxLength={150} onChange={(e) => set("businessName", e.target.value)} />
        </Field>
        <Field label="Business type" name="businessType" required error={errors.businessType}>
          <Select value={draft.businessType} disabled={disabled} onChange={(e) => set("businessType", e.target.value)}>
            <option value="">Select…</option>
            {BUSINESS_TYPES.map((t) => <option key={t.value} value={t.value}>{t.label}</option>)}
          </Select>
        </Field>
        <Field label="Business PAN" name="pan" required error={errors.pan} hint="Example: ABCDE1234F">
          <Input className="uppercase" value={draft.pan} disabled={disabled} autoComplete="off" maxLength={10} spellCheck={false} onChange={(e) => set("pan", e.target.value.toUpperCase())} />
        </Field>
        <Field label="GSTIN" name="gstin" error={errors.gstin} hint="If you are GST-registered. Leave blank otherwise." span={2}>
          <Input className="uppercase" value={draft.gstin} disabled={disabled} autoComplete="off" maxLength={15} spellCheck={false} onChange={(e) => set("gstin", e.target.value.toUpperCase())} />
        </Field>
        <Field label="Business address" name="address" required error={errors.address} span={2}>
          <Textarea className="min-h-[84px]" value={draft.address} disabled={disabled} autoComplete="street-address" maxLength={300} onChange={(e) => set("address", e.target.value)} />
        </Field>
        <Field label="State" name="state" required error={errors.state}>
          <Select value={draft.state} disabled={disabled} autoComplete="address-level1" onChange={(e) => set("state", e.target.value)}>
            <option value="">Select…</option>
            {INDIAN_STATES.map((s) => <option key={s} value={s}>{s}</option>)}
          </Select>
        </Field>
        <Field label="City" name="city" required error={errors.city}>
          <Input value={draft.city} disabled={disabled} autoComplete="address-level2" maxLength={80} onChange={(e) => set("city", e.target.value)} />
        </Field>
        <Field label="Pincode" name="pincode" required error={errors.pincode}>
          <Input inputMode="numeric" value={draft.pincode} disabled={disabled} autoComplete="postal-code" maxLength={6} onChange={(e) => set("pincode", digits(e.target.value, 6))} />
        </Field>
      </FormGrid>
    </>
  );
}

// ───────────────────────── 3 · products ─────────────────────────

export function ProductsStep({ draft, errors, set, disabled }: StepProps) {
  return (
    <>
      <StepTitle title="What do you sell?" note="This helps us route your application to the right reviewer. You list individual products after approval." />
      <div className="grid gap-6">
        <PartCategoryPicker
          id="categoryIds"
          required
          value={draft.categoryIds}
          onChange={(v) => set("categoryIds", v)}
          error={errors.categoryIds}
          hint="Choose a whole group or individual part types. Not finding yours? Use Other Automotive Parts."
          disabled={disabled}
        />
        <VehicleSegmentPicker
          required
          value={draft.vehicleSegments}
          onChange={(v) => set("vehicleSegments", v)}
          error={errors.vehicleSegments}
          disabled={disabled}
        />

        <CheckGroup
          legend="Vehicle brands supplied"
          name="vehicleBrands"
          required
          options={VEHICLE_BRANDS}
          value={draft.vehicleBrands}
          onChange={(v) => set("vehicleBrands", v)}
          error={errors.vehicleBrands}
          disabled={disabled}
        />
        {draft.vehicleBrands.includes("Other") && (
          <Field label="Other vehicle brands" name="otherVehicleBrand" required error={errors.otherVehicleBrand}>
            <Input value={draft.otherVehicleBrand} disabled={disabled} maxLength={100} onChange={(e) => set("otherVehicleBrand", e.target.value)} />
          </Field>
        )}

        <FormGrid>
          <Field label="Product brands" name="productBrands" required error={errors.productBrands} hint="Separate brands with commas, e.g. Minda, Rico" span={2}>
            <Input value={draft.productBrands} disabled={disabled} maxLength={300} onChange={(e) => set("productBrands", e.target.value)} />
          </Field>
          <Field label="Approximate number of SKUs" name="skuRange" required error={errors.skuRange}>
            <Select value={draft.skuRange} disabled={disabled} onChange={(e) => set("skuRange", e.target.value)}>
              <option value="">Select…</option>
              {SKU_RANGES.map((r) => <option key={r.value} value={r.value}>{r.label}</option>)}
            </Select>
          </Field>
          <Field label="Monthly supply capacity" name="monthlyCapacity" error={errors.monthlyCapacity} hint="Optional. For example: 5,000 pieces">
            <Input value={draft.monthlyCapacity} disabled={disabled} maxLength={150} onChange={(e) => set("monthlyCapacity", e.target.value)} />
          </Field>
        </FormGrid>
        <FileField
          docKey="catalogue"
          label="Product catalogue"
          file={draft.files.catalogue}
          error={errors.catalogue}
          hint="PDF, CSV or Excel. Helps us review faster; not required."
          onChange={(f) => set("files", withFile(draft.files, "catalogue", f))}
        />
      </div>
    </>
  );
}

function withFile(files: RegistrationDraft["files"], key: DocKey, file: File | undefined): RegistrationDraft["files"] {
  const next = { ...files };
  if (file) next[key] = file;
  else delete next[key];
  return next;
}

// ───────────────────────── 4 · bank & warehouse ─────────────────────────

export function BankStep({ draft, errors, set, disabled }: StepProps) {
  const sameAddress = draft.warehouseAddress !== "" && draft.warehouseAddress === draft.address;
  return (
    <>
      <StepTitle
        title="Bank and warehouse"
        note="Settlements are paid to this bank account, and couriers collect parcels from the warehouse address. Bank details are encrypted and never shown publicly."
      />
      <FormGrid>
        <Field label="Account holder name" name="accountHolder" required error={errors.accountHolder} span={2}>
          <Input value={draft.accountHolder} disabled={disabled} autoComplete="off" maxLength={120} onChange={(e) => set("accountHolder", e.target.value)} />
        </Field>
        <Field label="Bank name" name="bankName" required error={errors.bankName}>
          <Input value={draft.bankName} disabled={disabled} autoComplete="off" maxLength={100} onChange={(e) => set("bankName", e.target.value)} />
        </Field>
        <Field label="IFSC" name="ifsc" required error={errors.ifsc} hint="Example: HDFC0001234">
          <Input className="uppercase" value={draft.ifsc} disabled={disabled} autoComplete="off" maxLength={11} spellCheck={false} onChange={(e) => set("ifsc", e.target.value.toUpperCase())} />
        </Field>
        <Field label="Account number" name="accountNumber" required error={errors.accountNumber} span={2}>
          <Input inputMode="numeric" value={draft.accountNumber} disabled={disabled} autoComplete="off" maxLength={18} onChange={(e) => set("accountNumber", digits(e.target.value, 18))} />
        </Field>

        <div className="md:col-span-2">
          <label className="flex cursor-pointer items-center gap-3 text-sm text-[var(--text-primary)]">
            <Checkbox
              checked={sameAddress}
              disabled={disabled || !draft.address}
              onChange={(e) => {
                set("warehouseAddress", e.target.checked ? draft.address : "");
                if (e.target.checked && draft.pincode) set("warehousePincode", draft.pincode);
              }}
            />
            Warehouse is at my business address
          </label>
        </div>
        <Field label="Warehouse address" name="warehouseAddress" required error={errors.warehouseAddress} span={2}>
          <Textarea className="min-h-[84px]" value={draft.warehouseAddress} disabled={disabled} maxLength={300} onChange={(e) => set("warehouseAddress", e.target.value)} />
        </Field>
        <Field label="Warehouse pincode" name="warehousePincode" required error={errors.warehousePincode} hint="Used to check courier pickup availability">
          <Input inputMode="numeric" value={draft.warehousePincode} disabled={disabled} maxLength={6} onChange={(e) => set("warehousePincode", digits(e.target.value, 6))} />
        </Field>
        <Field label="Pickup contact number" name="pickupContact" required error={errors.pickupContact} hint="The courier calls this number">
          <Input type="tel" inputMode="tel" value={draft.pickupContact} disabled={disabled} maxLength={16} onChange={(e) => set("pickupContact", e.target.value)} />
        </Field>
      </FormGrid>
    </>
  );
}

// ───────────────────────── 5 · documents + review ─────────────────────────

function ReviewBlock({ title, step, onGo, disabled, rows }: { title: string; step: StepId; onGo: (s: StepId) => void; disabled: boolean; rows: [string, string | undefined][] }) {
  return (
    <section className="border-t border-black/15 py-4">
      <div className="mb-2 flex items-center justify-between">
        <h4 className="font-grotesk text-[13px] font-semibold uppercase tracking-[0.12em] text-mx-black">{title}</h4>
        <button
          type="button"
          disabled={disabled}
          onClick={() => onGo(step)}
          className="inline-flex items-center gap-1.5 text-[13px] font-semibold text-mx-red-deep underline-offset-4 hover:underline disabled:opacity-50 focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-mx-black"
        >
          <Pencil aria-hidden className="size-3" /> Edit<span className="sr-only"> {title}</span>
        </button>
      </div>
      <dl className="grid gap-x-8 gap-y-1.5 text-[14px] sm:grid-cols-[minmax(0,11rem)_1fr]">
        {rows.filter(([, v]) => v).map(([k, v]) => (
          <div key={k} className="contents">
            <dt className="text-[#6b6b73]">{k}</dt>
            <dd className="break-words text-mx-black">{v}</dd>
          </div>
        ))}
      </dl>
    </section>
  );
}

export function DocumentsStep({
  draft,
  errors,
  set,
  disabled,
  onGo,
}: StepProps & { onGo: (step: StepId) => void }) {
  const setFile = (key: DocKey) => (f: File | undefined) => set("files", withFile(draft.files, key, f));
  const f = draft.files;
  const typeLabel = BUSINESS_TYPES.find((t) => t.value === draft.businessType)?.label;
  const sku = SKU_RANGES.find((s) => s.value === draft.skuRange)?.label;
  const tree = usePartCategoryTree().state;
  const cats = tree.status === "ready" ? selectionChips(tree.groups, draft.categoryIds).map((c) => (c.isGroup ? `${c.label} (all)` : c.label)) : [];
  const segments = draft.vehicleSegments.map(vehicleSegmentLabel);
  const brands = [...draft.vehicleBrands.filter((b) => b !== "Other"), ...(draft.vehicleBrands.includes("Other") ? [`Other: ${draft.otherVehicleBrand}`] : [])];

  return (
    <>
      <StepTitle title="Upload documents and submit" note="PDF, JPG or PNG, up to 5 MB each. Files are sent over HTTPS to private storage and are visible only to MotoXPlus reviewers." />
      {errors.form && <FieldError className="mb-4">{errors.form}</FieldError>}
      <div className="grid gap-5 sm:grid-cols-2">
        <FileField docKey="panDocument" required file={f.panDocument} error={errors.panDocument} onChange={setFile("panDocument")} />
        <FileField
          docKey="gstCertificate"
          required={!!draft.gstin}
          file={f.gstCertificate}
          error={errors.gstCertificate}
          hint={draft.gstin ? undefined : "Needed only if you entered a GSTIN"}
          onChange={setFile("gstCertificate")}
        />
        <FileField docKey="businessProof" file={f.businessProof} error={errors.businessProof} hint="Where applicable, e.g. Udyam or shop licence" onChange={setFile("businessProof")} />
        <FileField docKey="bankProof" required file={f.bankProof} error={errors.bankProof} onChange={setFile("bankProof")} />
      </div>

      <div className="mt-10">
        <h3 className="font-grotesk text-[24px] font-semibold tracking-[-0.02em] text-mx-black">Review your application</h3>
        <p className="mt-1.5 text-[15px] text-[#4b4b52]">Check everything below. Your password is not shown.</p>
        <div className="mt-4 border-b border-black/15">
          <ReviewBlock title="Account" step="account" onGo={onGo} disabled={disabled} rows={[["Name", draft.fullName], ["Mobile", draft.mobile], ["Email", draft.email]]} />
          <ReviewBlock title="Business" step="business" onGo={onGo} disabled={disabled} rows={[
            ["Business", draft.businessName], ["Type", typeLabel], ["PAN", draft.pan], ["GSTIN", draft.gstin || "Not provided"],
            ["Address", `${draft.address}, ${draft.city}, ${draft.state} ${draft.pincode}`],
          ]} />
          <ReviewBlock title="Products" step="products" onGo={onGo} disabled={disabled} rows={[
            ["Categories", cats.join(", ") || `${draft.categoryIds.length} selected`], ["Vehicle segments", segments.join(", ")], ["Vehicle brands", brands.join(", ")], ["Product brands", draft.productBrands],
            ["Approx. SKUs", sku], ["Monthly capacity", draft.monthlyCapacity], ["Catalogue", f.catalogue?.name],
          ]} />
          <ReviewBlock title="Bank & warehouse" step="bank" onGo={onGo} disabled={disabled} rows={[
            ["Account holder", draft.accountHolder], ["Bank", draft.bankName], ["Account number", maskAccountNumber(draft.accountNumber)],
            ["IFSC", draft.ifsc], ["Warehouse", `${draft.warehouseAddress}, ${draft.warehousePincode}`], ["Pickup contact", draft.pickupContact],
          ]} />
        </div>
      </div>

      <div className="mt-8">
        <label className="flex cursor-pointer items-start gap-3 text-[15px] leading-snug text-mx-black">
          <Checkbox
            id="agreementAccepted"
            className="mt-0.5"
            checked={draft.agreementAccepted}
            disabled={disabled}
            aria-invalid={!!errors.agreementAccepted}
            aria-describedby={errors.agreementAccepted ? "agreementAccepted-error" : undefined}
            onChange={(e) => set("agreementAccepted", e.target.checked)}
          />
          <span>
            I have read and agree to the{" "}
            <a href={SELLER_AGREEMENT_URL} target="_blank" rel="noopener noreferrer" className="font-semibold text-mx-red-deep underline underline-offset-4">
              MotoXPlus Seller Agreement<span className="sr-only"> (opens in a new tab)</span>
            </a>
            , and confirm the information and documents I have provided are accurate.
          </span>
        </label>
        <FieldError id="agreementAccepted-error">{errors.agreementAccepted}</FieldError>
      </div>
    </>
  );
}
