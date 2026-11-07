"use client";

import * as React from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { Checkbox } from "@/components/ui/field";
import { usePartCategoryTree } from "@/components/catalog/use-part-category-tree";
import { vehicleSegmentLabel } from "@/lib/catalog/vehicle-segments";
import { SELLER_AGREEMENT_URL } from "@/lib/seller/config";
import { BUSINESS_TYPES } from "@/lib/seller/registration";
import { DOCUMENT_INFO, ONBOARDING_STEPS, stepDone, submitApplication, type VendorApplication } from "@/lib/vendor/onboarding";
import { errorsFrom, useApplication } from "./application-context";
import { Banner, StepActions, StepPage } from "./step-page";

export function ReviewStep() {
  return (
    <StepPage
      title="Review and submit"
      description="Check everything once. After you submit, our team reviews your application, usually within 2 business days, and you can't edit it while it's under review."
      backHref="/vendor/onboarding/documents"
    >
      {(app) => <ReviewForm app={app} />}
    </StepPage>
  );
}

const DECLARATIONS = [
  { key: "acceptTerms", node: <>I accept the MotoXPlus <a href="/terms" target="_blank" rel="noreferrer" className="font-semibold underline underline-offset-4">terms and conditions</a>.</> },
  { key: "acceptVendorAgreement", node: <>I accept the <a href={SELLER_AGREEMENT_URL} target="_blank" rel="noreferrer" className="font-semibold underline underline-offset-4">vendor agreement</a>.</> },
  { key: "declareGenuineProducts", node: <>I will sell only genuine products that I manufacture or am authorised to supply, and I will not list counterfeit or copied branded parts.</> },
  { key: "declareAccurateInformation", node: <>The business, bank and document information I have given is accurate and belongs to my business.</> },
] as const;

type DeclKey = (typeof DECLARATIONS)[number]["key"];

function ReviewForm({ app }: { app: VendorApplication }) {
  const router = useRouter();
  const { set } = useApplication();
  const [accepted, setAccepted] = React.useState<Record<DeclKey, boolean>>({
    acceptTerms: false,
    acceptVendorAgreement: false,
    declareGenuineProducts: false,
    declareAccurateInformation: false,
  });
  const [errors, setErrors] = React.useState<Record<string, string>>({});
  const [banner, setBanner] = React.useState("");
  const [busy, setBusy] = React.useState(false);
  const incomplete = ONBOARDING_STEPS.filter((s) => s.id !== "review" && !stepDone(app, s.id));

  async function submit(e: React.FormEvent) {
    e.preventDefault();
    setBanner("");
    const missing = DECLARATIONS.filter((d) => !accepted[d.key]);
    if (missing.length) {
      setErrors(Object.fromEntries(missing.map((d) => [d.key, "Required to submit"])));
      document.getElementById(`decl-${missing[0].key}`)?.focus();
      return;
    }
    setBusy(true);
    try {
      set(await submitApplication(accepted));
      router.push("/vendor/onboarding");
    } catch (err) {
      const { fields, message } = errorsFrom(err);
      setErrors(fields);
      // Incomplete steps come back keyed by check code; show them as one message.
      const stepMessages = Object.entries(fields).filter(([k]) => !k.startsWith("accept") && !k.startsWith("declare")).map(([, m]) => m);
      setBanner(stepMessages.length ? stepMessages.join(" · ") : message);
    } finally {
      setBusy(false);
    }
  }

  return (
    <form onSubmit={submit} noValidate>
      {incomplete.length > 0 && (
        <div className="mb-8">
          <Banner tone="error">
            Finish these first:{" "}
            {incomplete.map((s, i) => (
              <React.Fragment key={s.id}>
                {i > 0 && ", "}
                <Link href={s.href} className="font-semibold underline underline-offset-4">
                  {s.label}
                </Link>
              </React.Fragment>
            ))}
          </Banner>
        </div>
      )}
      {banner && (
        <div className="mb-8">
          <Banner tone="error">{banner}</Banner>
        </div>
      )}

      <div className="divide-y divide-[var(--line)] border-y border-[var(--line)]">
        <Section title="Account" href={null}>
          <Row label="Name" value={app.account.fullName} />
          <Row label="Email" value={app.account.email} />
          <Row label="Mobile" value={app.account.mobile} />
        </Section>
        <Section title="Business details" href="/vendor/onboarding/business" editable={app.editable}>
          {app.business ? (
            <>
              <Row label="Business" value={app.business.businessName} />
              <Row label="Type" value={BUSINESS_TYPES.find((t) => t.value === app.business!.businessType)?.label ?? app.business.businessType} />
              <Row label="PAN" value={app.business.pan} mono />
              <Row label="GSTIN" value={app.business.gstin || "Not GST-registered"} mono={!!app.business.gstin} />
              <Row label="Address" value={`${app.business.address}, ${app.business.city}, ${app.business.state} ${app.business.pincode}`} />
            </>
          ) : (
            <Empty />
          )}
        </Section>
        <Section title="Parts you supply" href="/vendor/onboarding/categories" editable={app.editable}>
          {app.categories ? <CategorySummary ids={app.categories.categoryIds} segments={app.categories.vehicleSegments} /> : <Empty />}
        </Section>
        <Section title="Bank account" href="/vendor/onboarding/bank" editable={app.editable}>
          {app.bank ? (
            <>
              <Row label="Holder" value={app.bank.accountHolder} />
              <Row label="Bank" value={`${app.bank.bankName} · ${app.bank.ifsc}`} />
              <Row label="Account" value={`•••• ${app.bank.accountNumberLast4}`} mono />
            </>
          ) : (
            <Empty />
          )}
        </Section>
        <Section title="Documents" href="/vendor/onboarding/documents" editable={app.editable}>
          {app.documents.length ? (
            app.documents.map((d) => <Row key={d.id} label={DOCUMENT_INFO[d.documentType]?.label ?? d.label} value={d.fileName} />)
          ) : (
            <Empty />
          )}
        </Section>
      </div>

      {app.editable && (
        <fieldset className="mt-10" disabled={busy}>
          <legend className="text-[17px] font-semibold">Declarations</legend>
          <div className="mt-4 space-y-3">
            {DECLARATIONS.map((d) => (
              <label
                key={d.key}
                htmlFor={`decl-${d.key}`}
                className={`flex cursor-pointer items-start gap-3 rounded-xl border px-4 py-3.5 text-[15px] leading-relaxed ${
                  errors[d.key] ? "border-[var(--sig-danger-fg)]" : "border-[var(--line)]"
                }`}
              >
                <Checkbox
                  id={`decl-${d.key}`}
                  checked={accepted[d.key]}
                  aria-invalid={!!errors[d.key]}
                  onChange={(e) => {
                    setAccepted((a) => ({ ...a, [d.key]: e.target.checked }));
                    setErrors((er) => ({ ...er, [d.key]: "" }));
                  }}
                  className="mt-1"
                />
                <span>{d.node}</span>
              </label>
            ))}
          </div>
        </fieldset>
      )}

      {app.editable && <StepActions backHref="/vendor/onboarding/documents" busy={busy} label="Submit application" disabled={incomplete.length > 0} />}
    </form>
  );
}

function Section({ title, href, editable, children }: { title: string; href: string | null; editable?: boolean; children: React.ReactNode }) {
  return (
    <section className="py-5">
      <div className="mb-3 flex items-center justify-between gap-4">
        <h2 className="text-[15px] font-semibold">{title}</h2>
        {href && editable && (
          <Link href={href} className="text-sm font-medium text-[var(--accent-text)] hover:underline">
            Edit
          </Link>
        )}
      </div>
      <dl className="space-y-1.5">{children}</dl>
    </section>
  );
}

function Row({ label, value, mono }: { label: string; value: string; mono?: boolean }) {
  return (
    <div className="grid grid-cols-[110px_minmax(0,1fr)] gap-3 text-sm sm:grid-cols-[140px_minmax(0,1fr)]">
      <dt className="text-[var(--muted)]">{label}</dt>
      <dd className={mono ? "font-mono break-all" : "break-words"}>{value}</dd>
    </div>
  );
}

function Empty() {
  return <p className="text-sm text-[var(--muted)]">Not filled in yet.</p>;
}

function CategorySummary({ ids, segments }: { ids: string[]; segments: string[] }) {
  const { state } = usePartCategoryTree();
  const names = React.useMemo(() => {
    if (state.status !== "ready") return null;
    const byId = new Map<string, string>();
    for (const g of state.groups) {
      byId.set(g.id, `${g.name} (all)`);
      for (const c of g.children) byId.set(c.id, c.name);
    }
    return ids.map((id) => byId.get(id) ?? "A category that is no longer offered");
  }, [state, ids]);
  return (
    <>
      <Row label="Categories" value={names ? names.join(", ") : `${ids.length} selected`} />
      <Row label="Vehicles" value={segments.map(vehicleSegmentLabel).join(", ")} />
    </>
  );
}
