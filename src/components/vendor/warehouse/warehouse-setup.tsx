"use client";

import * as React from "react";
import Link from "next/link";
import { RefreshCw, RotateCw } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Checkbox, Field, FormGrid, Input, Select, Textarea } from "@/components/ui/field";
import { PageHeader } from "@/components/ui/page-header";
import { StatusBadge } from "@/components/ui/status-badge";
import { ApiError } from "@/lib/api/client";
import {
  getWarehouse,
  previewWarehouseName,
  retryWarehouse,
  submitWarehouse,
  type WarehouseView,
} from "@/lib/vendor/warehouse";

type Load = { kind: "loading" } | { kind: "error"; message: string } | { kind: "ready"; view: WarehouseView };

function errorMessage(e: unknown): { fields: Record<string, string>; message: string } {
  if (e instanceof ApiError) {
    const fields = e.fieldErrors ?? {};
    if (e.code === "VENDOR_NOT_ACTIVE") return { fields: {}, message: "Your pickup warehouse can be set up once MotoXPlus approves your account." };
    if (e.status >= 500 && e.status !== 503) return { fields: {}, message: "Something went wrong on our side. Nothing was lost; please try again." };
    return { fields, message: Object.keys(fields).length ? "Please fix the highlighted fields." : e.message };
  }
  return { fields: {}, message: "We couldn't reach the server. Check your connection and try again." };
}

/**
 * The vendor's Delhivery pickup warehouse: where Delhivery collects their orders. Status first, then the one thing the
 * vendor can do next (set it up, fix and resubmit, or retry). Products can't go live until it is Active.
 */
export function WarehouseSetup() {
  const [state, setState] = React.useState<Load>({ kind: "loading" });

  const load = React.useCallback(async () => {
    try {
      setState({ kind: "ready", view: await getWarehouse() });
    } catch (e) {
      setState({ kind: "error", message: errorMessage(e).message });
    }
  }, []);

  React.useEffect(() => {
    void load();
  }, [load]);

  return (
    <div className="mx-auto max-w-[760px]">
      <PageHeader
        title="Pickup warehouse"
        description="Delhivery collects your orders from this address and returns undelivered parcels to it."
        rule={false}
        className="pb-0"
      />
      {state.kind === "loading" && <div className="h-64 animate-pulse rounded-lg bg-[var(--bg-card)]" aria-busy="true" />}
      {state.kind === "error" && (
        <Notice tone="danger" title="Couldn't load your warehouse">
          <p>{state.message}</p>
          <Button className="mt-4" variant="secondary" size="sm" icon={<RefreshCw />} onClick={() => void load()}>
            Try again
          </Button>
        </Notice>
      )}
      {state.kind === "ready" && <Ready view={state.view} onChange={(view) => setState({ kind: "ready", view })} onReload={load} />}
    </div>
  );
}

function Ready({ view, onChange, onReload }: { view: WarehouseView; onChange: (v: WarehouseView) => void; onReload: () => Promise<void> }) {
  const w = view.warehouse;
  const [retrying, setRetrying] = React.useState(false);
  const [retryError, setRetryError] = React.useState("");

  async function retry() {
    setRetrying(true);
    setRetryError("");
    try {
      onChange(await retryWarehouse());
    } catch (e) {
      setRetryError(errorMessage(e).message);
    } finally {
      setRetrying(false);
    }
  }

  if (!w) return <WarehouseForm view={view} onSaved={onChange} />;

  return (
    <div className="space-y-6">
      <section className="rounded-lg border border-[var(--border-subtle)] bg-[var(--bg-card)]">
        <div className="flex flex-wrap items-center justify-between gap-3 border-b border-[var(--border-subtle)] px-5 py-4">
          <div className="min-w-0">
            <p className="text-12 font-semibold uppercase tracking-[0.06em] text-[var(--text-muted)]">Delhivery name</p>
            <p className="mt-0.5 break-all font-mono text-17 text-[var(--text-primary)]">{w.delhiveryName}</p>
          </div>
          <StatusBadge domain="warehouse" value={w.status} />
        </div>
        <dl className="grid gap-x-8 gap-y-5 px-5 py-5 text-14 md:grid-cols-2">
          <Detail label="Pickup address">
            {w.details.address}
            <br />
            {w.details.city}, {w.details.state} {w.details.pin}
          </Detail>
          <Detail label="Return address">
            {w.details.returnAddress}
            <br />
            {w.details.returnCity}, {w.details.returnState} {w.details.returnPin}
          </Detail>
          <Detail label="Contact">
            <span className="tnum">{w.details.phone}</span>
            <br />
            {w.details.email}
          </Detail>
          {w.gstin && (
            <Detail label="GSTIN">
              <span className="font-mono">{w.gstin}</span>
            </Detail>
          )}
        </dl>
      </section>

      {w.status === "ACTIVE" && (
        <Notice tone="ok" title="Ready for orders">
          <p>
            Your products can go live. <Link href="/vendor/listings" className="font-semibold text-[var(--accent-text)] hover:underline">Go to listings</Link>
          </p>
          <p className="mt-2 text-[var(--text-muted)]">
            The Delhivery name is permanent. To change this address, contact MotoXPlus support.
          </p>
        </Notice>
      )}

      {w.status === "PENDING" && (
        <Notice tone="progress" title="Setting up with Delhivery">
          <p>This usually takes a few seconds.</p>
          <Button className="mt-4" variant="secondary" size="sm" icon={<RefreshCw />} onClick={() => void onReload()}>
            Check again
          </Button>
          {view.canRetry && <RetryButton busy={retrying} onClick={retry} />}
        </Notice>
      )}

      {w.status === "FAILED" && (
        <Notice tone="danger" title="Delhivery couldn't set this up">
          {w.lastError && <p className="break-words font-mono text-12">{w.lastError}</p>}
          <p className="mt-2">
            {w.lastErrorCode === "UNCERTAIN"
              ? "Delhivery may have created it already, so the details are locked. Retry and we'll confirm it."
              : w.lastErrorCode === "NOT_SENT"
                ? "Nothing was created. Retry in a little while, or correct the details below."
                : "Nothing was created. Correct the details below, or retry if they are right."}
          </p>
          <p className="mt-2 text-[var(--text-muted)]">Your products can&apos;t go live until this is active.</p>
          {view.canRetry && <RetryButton busy={retrying} onClick={retry} />}
        </Notice>
      )}

      {retryError && <p role="alert" className="text-14 text-[var(--sig-danger-fg)]">{retryError}</p>}

      {w.status === "FAILED" && view.canSubmit && (
        <section>
          <h2 className="mb-4 text-17 font-semibold text-[var(--text-primary)]">Correct the details</h2>
          <WarehouseForm view={view} onSaved={onChange} />
        </section>
      )}
    </div>
  );
}

function RetryButton({ busy, onClick }: { busy: boolean; onClick: () => void }) {
  return (
    <Button className="mt-4 ml-0 sm:ml-2" size="sm" icon={<RotateCw />} loading={busy} onClick={onClick}>
      Retry setup
    </Button>
  );
}

function Detail({ label, children }: { label: string; children: React.ReactNode }) {
  return (
    <div className="min-w-0">
      <dt className="text-12 font-semibold uppercase tracking-[0.06em] text-[var(--text-muted)]">{label}</dt>
      <dd className="mt-1 break-words leading-relaxed text-[var(--text-primary)]">{children}</dd>
    </div>
  );
}

function Notice({ tone, title, children }: { tone: "ok" | "progress" | "danger"; title: string; children: React.ReactNode }) {
  return (
    <div
      data-tone={tone}
      role={tone === "danger" ? "alert" : "status"}
      className="rounded-lg border border-[var(--tone-bd)] bg-[var(--tone-bg)] px-5 py-4 text-14 text-[var(--text-primary)]"
    >
      <p className="font-semibold text-[var(--tone-fg)]">{title}</p>
      <div className="mt-1.5">{children}</div>
    </div>
  );
}

const PIN_RE = /^[1-9][0-9]{5}$/;

function WarehouseForm({ view, onSaved }: { view: WarehouseView; onSaved: (v: WarehouseView) => void }) {
  const current = view.warehouse?.details;
  const p = view.prefill;
  const [v, setV] = React.useState({
    address: current?.address ?? p.address ?? "",
    pin: current?.pin ?? p.pin ?? "",
    city: current?.city ?? p.city ?? "",
    state: current?.state ?? p.state ?? "",
    phone: current?.phone ?? p.phone ?? "",
    email: current?.email ?? p.email ?? "",
    returnAddress: current?.returnAddress ?? "",
    returnPin: current?.returnPin ?? "",
    returnCity: current?.returnCity ?? "",
    returnState: current?.returnState ?? "",
  });
  const [same, setSame] = React.useState(
    !current || (current.returnAddress === current.address && current.returnPin === current.pin)
  );
  const [errors, setErrors] = React.useState<Record<string, string>>({});
  const [banner, setBanner] = React.useState("");
  const [busy, setBusy] = React.useState(false);

  const on = (k: keyof typeof v) => (e: React.ChangeEvent<HTMLInputElement | HTMLTextAreaElement | HTMLSelectElement>) => {
    const value = k === "pin" || k === "returnPin" ? e.target.value.replace(/\D/g, "").slice(0, 6) : e.target.value;
    setV((s) => ({ ...s, [k]: value }));
    setErrors((er) => ({ ...er, [k]: "" }));
  };

  const name = PIN_RE.test(v.pin) ? previewWarehouseName(view.vendorCode, v.pin) : null;

  async function submit(e: React.FormEvent) {
    e.preventDefault();
    setBanner("");
    const errs: Record<string, string> = {};
    if (v.address.trim().length < 5) errs.address = "Enter the full address";
    if (!PIN_RE.test(v.pin)) errs.pin = "Enter a 6-digit PIN code";
    if (v.city.trim().length < 2) errs.city = "Required";
    if (!v.state) errs.state = "Choose a state";
    if (v.phone.replace(/\D/g, "").length < 10) errs.phone = "Enter a 10-digit mobile number";
    if (!/^[^\s@]+@[^\s@]+\.[^\s@]{2,}$/.test(v.email.trim())) errs.email = "Enter a valid email address";
    if (!same) {
      if (v.returnAddress.trim().length < 5) errs.returnAddress = "Enter the full address";
      if (!PIN_RE.test(v.returnPin)) errs.returnPin = "Enter a 6-digit PIN code";
      if (v.returnCity.trim().length < 2) errs.returnCity = "Required";
      if (!v.returnState) errs.returnState = "Choose a state";
    }
    setErrors(errs);
    if (Object.keys(errs).length) return;

    setBusy(true);
    try {
      onSaved(
        await submitWarehouse({
          address: v.address.trim(),
          pin: v.pin,
          city: v.city.trim(),
          state: v.state,
          phone: v.phone.trim(),
          email: v.email.trim(),
          returnSameAsPickup: same,
          ...(same ? {} : { returnAddress: v.returnAddress.trim(), returnPin: v.returnPin, returnCity: v.returnCity.trim(), returnState: v.returnState }),
        })
      );
    } catch (err) {
      const { fields, message } = errorMessage(err);
      setErrors(fields);
      setBanner(message);
    } finally {
      setBusy(false);
    }
  }

  return (
    <form onSubmit={submit} noValidate className="rounded-lg border border-[var(--border-subtle)] bg-[var(--bg-card)] px-5 py-6">
      <fieldset disabled={busy} className="min-w-0">
        {banner && (
          <p role="alert" className="mb-5 text-14 text-[var(--sig-danger-fg)]">
            {banner}
          </p>
        )}
        <FormGrid columns={2}>
          <Field label="Pickup address" name="address" required error={errors.address} span={2}
            hint="Building, street and area. Delhivery's executive comes here to collect.">
            <Textarea value={v.address} onChange={on("address")} rows={2} maxLength={300} />
          </Field>
          <Field label="PIN code" name="pin" required error={errors.pin}>
            <Input value={v.pin} onChange={on("pin")} inputMode="numeric" autoComplete="postal-code" className="tnum" />
          </Field>
          <Field label="City" name="city" required error={errors.city}>
            <Input value={v.city} onChange={on("city")} maxLength={80} autoComplete="address-level2" />
          </Field>
          <Field label="State" name="state" required error={errors.state}>
            <Select value={v.state} onChange={on("state")}>
              <option value="">Choose a state</option>
              {view.states.map((s) => (
                <option key={s} value={s}>
                  {s}
                </option>
              ))}
            </Select>
          </Field>
          <Field label="Pickup contact mobile" name="phone" required error={errors.phone}>
            <Input value={v.phone} onChange={on("phone")} inputMode="tel" autoComplete="tel" className="tnum" />
          </Field>
          <Field label="Pickup contact email" name="email" required error={errors.email} span={2}>
            <Input value={v.email} onChange={on("email")} type="email" autoComplete="email" />
          </Field>
        </FormGrid>

        <label className="mt-6 flex items-center gap-3 text-14 text-[var(--text-primary)]">
          <Checkbox checked={same} onChange={(e) => setSame(e.target.checked)} />
          Return undelivered parcels to the same address
        </label>

        {!same && (
          <div className="mt-5">
            <FormGrid columns={2}>
              <Field label="Return address" name="returnAddress" required error={errors.returnAddress} span={2}>
                <Textarea value={v.returnAddress} onChange={on("returnAddress")} rows={2} maxLength={300} />
              </Field>
              <Field label="Return PIN code" name="returnPin" required error={errors.returnPin}>
                <Input value={v.returnPin} onChange={on("returnPin")} inputMode="numeric" className="tnum" />
              </Field>
              <Field label="Return city" name="returnCity" required error={errors.returnCity}>
                <Input value={v.returnCity} onChange={on("returnCity")} maxLength={80} />
              </Field>
              <Field label="Return state" name="returnState" required error={errors.returnState}>
                <Select value={v.returnState} onChange={on("returnState")}>
                  <option value="">Choose a state</option>
                  {view.states.map((s) => (
                    <option key={s} value={s}>
                      {s}
                    </option>
                  ))}
                </Select>
              </Field>
            </FormGrid>
          </div>
        )}

        <div className="mt-8 flex flex-col gap-4 border-t border-[var(--border-subtle)] pt-5 sm:flex-row sm:items-center sm:justify-between">
          <p className="text-12 leading-relaxed text-[var(--text-muted)]">
            Registered with Delhivery as{" "}
            <span className="font-mono text-[var(--text-primary)]">{name ?? `VND-${view.vendorCode}-······`}</span>.
            <br />
            This name is permanent, so check the PIN code.
          </p>
          <Button type="submit" loading={busy} className="shrink-0">
            Set up with Delhivery
          </Button>
        </div>
      </fieldset>
    </form>
  );
}
