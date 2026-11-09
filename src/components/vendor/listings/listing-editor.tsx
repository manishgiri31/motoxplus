"use client";

import * as React from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { CircleAlert, RefreshCw } from "lucide-react";
import { Button } from "@/components/ui/button";
import { ConfirmDialog } from "@/components/ui/dialog";
import { Field, FormGrid, Input, Select, Textarea } from "@/components/ui/field";
import { PageHeader } from "@/components/ui/page-header";
import { toast } from "@/components/ui/toast";
import { cn } from "@/lib/utils";
import {
  emptyForm,
  formFromListing,
  getListing,
  getListingsOverview,
  orderedErrors,
  parseAmount,
  publishListing,
  publishProblems,
  createListing,
  toInput,
  unpublishListing,
  updateListing,
  validateFormat,
  FIELD_ORDER,
  type FieldErrors,
  type FieldKey,
  type Listing,
  type ListingFormValues,
  type ListingsOverview,
} from "@/lib/vendor/listings";
import { errorsFrom, unavailable } from "./errors";
import { FitmentPicker } from "./fitment-picker";
import { PhotoManager } from "./photo-manager";
import { PriceLadder } from "./price-ladder";
import { CHECKLIST, PublishPanel, type Busy } from "./publish-panel";

type Load =
  | { kind: "loading" }
  | { kind: "unavailable" }
  | { kind: "missing" }
  | { kind: "ready"; overview: ListingsOverview };

/**
 * Create (no `listingId`) and edit one listing. The form is the vendor's draft; the server's copy is `listing`. Saving
 * a live listing updates the storefront at once, so a live listing must stay complete: the same rules as publishing
 * apply to every save while it is live.
 */
export function ListingEditor({ listingId }: { listingId?: string }) {
  const router = useRouter();
  const [load, setLoad] = React.useState<Load>({ kind: "loading" });
  const [listing, setListing] = React.useState<Listing | null>(null);
  const [values, setValues] = React.useState<ListingFormValues>(emptyForm);
  const [saved, setSaved] = React.useState<ListingFormValues>(emptyForm);
  const [errors, setErrors] = React.useState<FieldErrors>({});
  const [banner, setBanner] = React.useState("");
  const [busy, setBusy] = React.useState<Busy>(null);
  const [confirmUnpublish, setConfirmUnpublish] = React.useState(false);

  const fetchAll = React.useCallback(async () => {
    setLoad({ kind: "loading" });
    try {
      const [overview, l] = await Promise.all([getListingsOverview(), listingId ? getListing(listingId) : Promise.resolve(null)]);
      if (l) {
        const form = formFromListing(l);
        setListing(l);
        setValues(form);
        setSaved(form);
      }
      setLoad({ kind: "ready", overview });
    } catch (e) {
      setLoad({ kind: unavailable(e) ? "unavailable" : "missing" });
    }
  }, [listingId]);

  React.useEffect(() => {
    void fetchAll();
  }, [fetchAll]);

  // Arriving from "Save draft" on a new listing: take the vendor straight to photos.
  React.useEffect(() => {
    if (load.kind === "ready" && typeof window !== "undefined" && window.location.hash === "#photos") {
      document.getElementById("images")?.scrollIntoView({ behavior: "smooth", block: "center" });
    }
  }, [load.kind]);

  const dirty = React.useMemo(() => JSON.stringify(values) !== JSON.stringify(saved), [values, saved]);

  React.useEffect(() => {
    if (!dirty) return;
    const warn = (e: BeforeUnloadEvent) => e.preventDefault();
    window.addEventListener("beforeunload", warn);
    return () => window.removeEventListener("beforeunload", warn);
  }, [dirty]);

  const status = listing?.status ?? null;
  const live = status === "LIVE";
  const imageCount = listing?.images.length ?? 0;
  const format = React.useMemo(() => validateFormat(values), [values]);
  const problems = React.useMemo(() => publishProblems(values, imageCount), [values, imageCount]);
  const checklist = CHECKLIST.map((c) => ({ ...c, done: !problems[c.key] && !format[c.key] }));

  // Price mistakes (wrong order, zero, paise) are worth showing while typing; everything else waits for a save attempt.
  const shown: FieldErrors = { ...errors };
  for (const k of ["mrp", "retailPrice", "dealerPrice"] as const) {
    if (format[k] && values[k].trim() !== "") shown[k] = format[k];
  }
  const ladderPrice = (raw: string) => {
    const n = parseAmount(raw);
    return n != null && Number.isFinite(n) && n > 0 ? n : null;
  };

  const set =
    (k: Exclude<keyof ListingFormValues, "fitment">) =>
    (e: React.ChangeEvent<HTMLInputElement | HTMLSelectElement | HTMLTextAreaElement>) => {
      const v = e.target.value;
      setValues((s) => ({ ...s, [k]: v }));
      if (errors[k as FieldKey]) setErrors((er) => ({ ...er, [k]: undefined }));
    };

  function jumpTo(key: FieldKey) {
    const el = document.getElementById(key);
    if (!el) return;
    el.scrollIntoView({ behavior: "smooth", block: "center" });
    if (el instanceof HTMLInputElement || el instanceof HTMLSelectElement || el instanceof HTMLTextAreaElement) {
      el.focus({ preventScroll: true });
    }
  }

  function showErrors(e: FieldErrors, message?: string) {
    const ordered = orderedErrors(e);
    setErrors(ordered);
    setBanner(message ?? "");
    const first = FIELD_ORDER.find((k) => ordered[k]);
    if (first) requestAnimationFrame(() => jumpTo(first));
  }

  /** Server copy -> the panel state; the form too, unless the vendor has unsaved edits we must keep. */
  function applyServer(l: Listing, resetForm: boolean) {
    setListing(l);
    if (resetForm) {
      const form = formFromListing(l);
      setValues(form);
      setSaved(form);
    }
  }

  async function save(): Promise<Listing | null> {
    setBanner("");
    const check = live ? { ...problems, ...format } : format;
    if (Object.keys(check).length) {
      showErrors(check, live ? "This listing is live, so every required detail must stay filled in." : undefined);
      return null;
    }
    setBusy("save");
    try {
      if (!listingId) {
        const created = await createListing(toInput(values));
        setSaved(values); // nothing left unsaved: no leave warning on the redirect
        toast.success("Draft saved", "Add photos next, then publish.");
        router.replace(`/vendor/listings/${created.id}#photos`);
        return created;
      }
      const l = await updateListing(listingId, toInput(values));
      applyServer(l, true);
      setErrors({});
      toast.success(live ? "Changes are live" : "Draft saved");
      return l;
    } catch (e) {
      const { fields, message } = errorsFrom(e);
      showErrors(fields, message);
      return null;
    } finally {
      setBusy(null);
    }
  }

  async function publish() {
    if (!listingId) return;
    setBanner("");
    const check = { ...problems, ...format };
    if (Object.keys(check).length) {
      const n = Object.keys(check).length;
      showErrors(check, n === 1 ? Object.values(check)[0] : `${n} things to finish before this listing can go live.`);
      return;
    }
    setBusy("publish");
    try {
      if (dirty) applyServer(await updateListing(listingId, toInput(values)), true);
      const l = await publishListing(listingId);
      applyServer(l, true);
      setErrors({});
      toast.success("Your listing is live", "Buyers can now find it in search.");
    } catch (e) {
      const { fields, message } = errorsFrom(e);
      showErrors(fields, message);
    } finally {
      setBusy(null);
    }
  }

  async function unpublish() {
    if (!listingId) return;
    setBusy("unpublish");
    try {
      const l = await unpublishListing(listingId);
      applyServer(l, !dirty);
      setConfirmUnpublish(false);
      toast.success("Listing unpublished", "It's hidden from buyers. Publish again whenever you're ready.");
    } catch (e) {
      setConfirmUnpublish(false);
      setBanner(errorsFrom(e).message);
    } finally {
      setBusy(null);
    }
  }

  // ───────────────────────── states ─────────────────────────

  if (load.kind === "loading") return <EditorSkeleton />;
  if (load.kind === "unavailable" || load.kind === "missing") {
    return (
      <div className="mx-auto max-w-xl py-16 text-center">
        <h1 className="text-[22px] font-semibold text-[var(--text-primary)]">
          {load.kind === "missing" ? "Listing not found" : "Listings aren't available right now"}
        </h1>
        <p className="mt-2 text-14 text-[var(--text-muted)]">
          {load.kind === "missing"
            ? "It may have been removed, or it belongs to another account."
            : "We couldn't reach the listings service. Nothing you saved is lost."}
        </p>
        <div className="mt-6 flex justify-center gap-2">
          <Button variant="secondary" asChild>
            <Link href="/vendor/listings">All listings</Link>
          </Button>
          {load.kind === "unavailable" && (
            <Button onClick={() => void fetchAll()} icon={<RefreshCw />}>
              Try again
            </Button>
          )}
        </div>
      </div>
    );
  }

  const { overview } = load;
  const knownCategory = overview.categories.some((g) => g.children.some((c) => c.id === values.categoryId));
  const disabled = busy !== null;
  // The saved title: a heading that re-flows on every keystroke is noise.
  const title = listing?.title || "New listing";

  return (
    <div className="mx-auto max-w-[1120px] pb-28 lg:pb-0">
      <PageHeader
        title={title}
        breadcrumbs={[{ label: "Listings", href: "/vendor/listings" }, { label: listingId ? "Edit" : "New listing" }]}
        meta={
          listing?.partNumber || listing?.sku ? (
            <span className="font-mono text-12 text-[var(--text-muted)]">
              {[listing.partNumber, listing.sku].filter(Boolean).join(" · ")}
            </span>
          ) : undefined
        }
        className="mb-6 pb-0"
        rule={false}
      />

      {banner && (
        <div role="alert" className="mb-6 flex items-start gap-3 rounded-lg border border-[var(--sig-danger-bd)] bg-[var(--sig-danger-bg)] px-4 py-3 text-14 text-[var(--sig-danger-fg)]">
          <CircleAlert aria-hidden className="mt-0.5 size-4 shrink-0" />
          <span>{banner}</span>
        </div>
      )}

      <div className="grid items-start gap-6 lg:grid-cols-[minmax(0,1fr)_300px] xl:gap-8">
        {/* No implicit submit: pressing Enter in a field of a live listing must not push half-made edits to the storefront. */}
        <form
          noValidate
          onSubmit={(e) => e.preventDefault()}
          className="min-w-0 rounded-lg border border-[var(--border-subtle)] bg-[var(--bg-card)] px-5 md:px-8"
        >
          <fieldset disabled={disabled} className="min-w-0">
            <Section id="details" title="Product" description="How buyers will find and recognise the part.">
              <FormGrid columns={2}>
                <Field label="Title" name="title" required error={shown.title} span={2}
                  hint="Part, position and model, the way a mechanic would search. E.g. Front brake pad set for Hero Splendor Plus">
                  <Input value={values.title} onChange={set("title")} maxLength={150} autoComplete="off" />
                </Field>
                <Field label="Category" name="categoryId" required error={shown.categoryId}
                  hint={overview.categories.length === 0 ? "No categories are approved for your account yet. Contact MotoXPlus." : undefined}>
                  <Select value={values.categoryId} onChange={set("categoryId")}>
                    <option value="">Choose a category</option>
                    {!knownCategory && values.categoryId && (
                      <option value={values.categoryId}>{listing?.categoryName ?? "Current category"} (no longer available)</option>
                    )}
                    {overview.categories.map((g) => (
                      <optgroup key={g.id} label={g.name}>
                        {g.children.map((c) => (
                          <option key={c.id} value={c.id}>
                            {c.name}
                          </option>
                        ))}
                      </optgroup>
                    ))}
                  </Select>
                </Field>
                <Field label="Brand" name="brand" required error={shown.brand}>
                  <Input value={values.brand} onChange={set("brand")} maxLength={80} />
                </Field>
                <Field label="Part number" name="partNumber" required error={shown.partNumber} hint="As printed on the part or its box">
                  <Input value={values.partNumber} onChange={set("partNumber")} maxLength={60} spellCheck={false} className="font-mono" />
                </Field>
                <Field label="Your SKU" name="sku" required error={shown.sku} hint="Your own stock code, unique across your listings">
                  <Input value={values.sku} onChange={set("sku")} maxLength={60} spellCheck={false} className="font-mono" />
                </Field>
                <Field label="Description" name="description" error={shown.description} span={2}
                  hint="Material, size, what's in the box. No phone numbers or links.">
                  <Textarea value={values.description} onChange={set("description")} rows={4} maxLength={5000} />
                </Field>
              </FormGrid>
            </Section>
          </fieldset>

          <Section id="photos" title="Photos" description="At least one to publish. The first photo is the one buyers see in search.">
            <div id="images" tabIndex={-1} className="outline-none">
              <PhotoManager
                listingId={listingId ?? null}
                images={listing?.images ?? []}
                max={overview.limits.maxImages}
                error={shown.images}
                disabled={disabled}
                onChange={(l) => {
                  applyServer(l, false);
                  setErrors((er) => ({ ...er, images: undefined }));
                }}
              />
            </div>
          </Section>

          <fieldset disabled={disabled} className="min-w-0">
            <Section id="pricing" title="Pricing" description="You set all three. They must run MRP, then retail, then dealer.">
              <FormGrid columns={3}>
                <Field label="MRP" name="mrp" required error={shown.mrp} hint="Printed maximum price">
                  <MoneyInput value={values.mrp} onChange={set("mrp")} />
                </Field>
                <Field label="Retail price" name="retailPrice" required error={shown.retailPrice} hint="What a consumer pays">
                  <MoneyInput value={values.retailPrice} onChange={set("retailPrice")} />
                </Field>
                <Field label="Dealer price" name="dealerPrice" required error={shown.dealerPrice} hint="What a dealer pays">
                  <MoneyInput value={values.dealerPrice} onChange={set("dealerPrice")} />
                </Field>
              </FormGrid>
              <PriceLadder
                mrp={ladderPrice(values.mrp)}
                retail={ladderPrice(values.retailPrice)}
                dealer={ladderPrice(values.dealerPrice)}
                commissionBp={overview.commission.saleCommissionBp}
                errors={{ retailPrice: shown.retailPrice, dealerPrice: shown.dealerPrice }}
              />
            </Section>

            <Section id="stock-section" title="Stock" description="Units you have ready to ship today.">
              <FormGrid columns={2}>
                <Field label="In stock" name="stock" required error={shown.stock}>
                  <Input value={values.stock} onChange={set("stock")} inputMode="numeric" className="tnum" />
                </Field>
                <Field label="Minimum order quantity" name="moq" error={shown.moq} hint="Smallest quantity a dealer can order">
                  <Input value={values.moq} onChange={set("moq")} inputMode="numeric" className="tnum" />
                </Field>
              </FormGrid>
            </Section>

            <Section id="fitment-section" title="Fits these vehicles" description="Helps buyers searching by bike or scooter.">
              <FitmentPicker
                value={values.fitment}
                onChange={(fitment) => {
                  setValues((s) => ({ ...s, fitment }));
                  if (errors.fitment) setErrors((er) => ({ ...er, fitment: undefined }));
                }}
                max={overview.limits.maxFitment}
                error={shown.fitment}
                disabled={disabled}
              />
            </Section>

            <Section id="tax" title="Tax and shipping" description="Used on invoices and for delivery charges.">
              <FormGrid columns={2}>
                <Field label="HSN code" name="hsnCode" required error={shown.hsnCode} hint="4, 6 or 8 digits, as on your GST invoices">
                  <Input value={values.hsnCode} onChange={set("hsnCode")} inputMode="numeric" maxLength={10} className="font-mono" />
                </Field>
                <Field label="GST rate" name="gstRate" error={shown.gstRate}>
                  <Select value={values.gstRate} onChange={set("gstRate")}>
                    {overview.gstRates.map((r) => (
                      <option key={r} value={String(r)}>
                        {r}%
                      </option>
                    ))}
                  </Select>
                </Field>
                <Field label="Packed weight (grams)" name="weightGrams" error={shown.weightGrams}>
                  <Input value={values.weightGrams} onChange={set("weightGrams")} inputMode="numeric" className="tnum" />
                </Field>
                <Field label="Warranty" name="warranty" error={shown.warranty} hint="E.g. 6 months. Leave empty for none.">
                  <Input value={values.warranty} onChange={set("warranty")} maxLength={80} />
                </Field>
                <Field label="Country of origin" name="countryOfOrigin" error={shown.countryOfOrigin}>
                  <Input value={values.countryOfOrigin} onChange={set("countryOfOrigin")} maxLength={60} />
                </Field>
              </FormGrid>
            </Section>
          </fieldset>
        </form>

        <aside className="lg:sticky lg:top-8" aria-label="Publishing">
          <PublishPanel
            status={status}
            storefront={listing?.storefront ?? null}
            checklist={checklist}
            dirty={dirty}
            busy={busy}
            onSave={() => void save()}
            onPublish={() => void publish()}
            onUnpublish={() => setConfirmUnpublish(true)}
            onJump={jumpTo}
          />
        </aside>
      </div>

      {/* Phones: the next step stays in reach without scrolling to the end of a long form. */}
      <div className="fixed inset-x-0 bottom-0 z-30 flex items-center gap-3 border-t border-[var(--border-subtle)] bg-[var(--bg-card)] px-4 py-3 lg:hidden">
        <span className="min-w-0 flex-1 truncate text-12 text-[var(--text-muted)]">
          {Object.keys(problems).length === 0 ? (live ? "Live" : "Ready to publish") : `${Object.keys(problems).length} to finish`}
          {dirty && " · unsaved"}
        </span>
        {!listingId || live ? (
          <Button size="sm" onClick={() => void save()} loading={busy === "save"} disabled={disabled || (live && !dirty)}>
            {listingId ? "Save changes" : "Save draft"}
          </Button>
        ) : (
          <>
            <Button size="sm" variant="ghost" onClick={() => void save()} loading={busy === "save"} disabled={disabled || !dirty}>
              Save
            </Button>
            <Button size="sm" onClick={() => void publish()} loading={busy === "publish"} disabled={disabled}>
              Publish
            </Button>
          </>
        )}
      </div>

      <ConfirmDialog
        open={confirmUnpublish}
        onOpenChange={setConfirmUnpublish}
        title="Unpublish this listing?"
        description="Buyers won't find it in search or on its product page. Your details, photos and prices are kept, and you can publish again at any time."
        confirmLabel="Unpublish"
        onConfirm={() => void unpublish()}
        loading={busy === "unpublish"}
      />
    </div>
  );
}

function Section({ id, title, description, children }: { id: string; title: string; description: string; children: React.ReactNode }) {
  return (
    <section id={id} aria-labelledby={`${id}-title`} className="scroll-mt-24 border-t border-[var(--border-subtle)] py-7 first:border-t-0 md:py-8">
      <div className="mb-5">
        <h2 id={`${id}-title`} className="text-17 font-semibold text-[var(--text-primary)]">
          {title}
        </h2>
        <p className="mt-0.5 text-14 text-[var(--text-muted)]">{description}</p>
      </div>
      {children}
    </section>
  );
}

const MoneyInput = React.forwardRef<
  HTMLInputElement,
  Omit<React.InputHTMLAttributes<HTMLInputElement>, "type"> & { invalid?: boolean }
>(function MoneyInput({ className, ...props }, ref) {
  return (
    <div className="relative">
      <span aria-hidden className="pointer-events-none absolute left-3 top-1/2 -translate-y-1/2 text-14 text-[var(--text-muted)]">
        ₹
      </span>
      <Input ref={ref} inputMode="numeric" autoComplete="off" className={cn("tnum pl-7", className)} {...props} />
    </div>
  );
});

function EditorSkeleton() {
  return (
    <div className="mx-auto max-w-[1120px]" aria-busy="true" aria-label="Loading listing">
      <div className="mb-8 h-8 w-64 animate-pulse rounded bg-[var(--surface-2)]" />
      <div className="grid gap-6 lg:grid-cols-[minmax(0,1fr)_300px]">
        <div className="space-y-4 rounded-lg border border-[var(--border-subtle)] bg-[var(--bg-card)] p-8">
          {Array.from({ length: 6 }).map((_, i) => (
            <div key={i} className="h-11 animate-pulse rounded bg-[var(--surface-2)]" />
          ))}
        </div>
        <div className="h-80 animate-pulse rounded-lg border border-[var(--border-subtle)] bg-[var(--bg-card)]" />
      </div>
    </div>
  );
}
