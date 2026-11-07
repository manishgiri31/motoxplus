"use client";

import * as React from "react";
import Link from "next/link";
import { AlertTriangle, ArrowLeft, CheckCircle2, ExternalLink, Eye, XCircle } from "lucide-react";
import { ApiError } from "@/lib/api/client";
import { vehicleSegmentLabel } from "@/lib/catalog/vehicle-segments";
import { BUSINESS_TYPES } from "@/lib/seller/registration";
import { DOCUMENT_INFO } from "@/lib/vendor/onboarding";
import {
  HISTORY_LABELS,
  decide,
  getApplicationDetail,
  revealAccountNumber,
  reviewDocumentUrl,
  type ApplicationDetail,
  type ReviewAction,
} from "@/lib/vendor/review";
import { StateBadge } from "./state-badge";

const ACTION_COPY: Record<ReviewAction, { label: string; needsReason: boolean; confirm: string; tone: "primary" | "danger" | "neutral" }> = {
  approve: { label: "Approve", needsReason: false, confirm: "Approve and activate this vendor?", tone: "primary" },
  "request-changes": { label: "Request changes", needsReason: true, confirm: "Send the application back to the vendor with this note.", tone: "neutral" },
  reject: { label: "Reject", needsReason: true, confirm: "Reject this application. The vendor is emailed the reason.", tone: "danger" },
  suspend: { label: "Suspend", needsReason: true, confirm: "Suspend this vendor. Their products stop selling until reactivated.", tone: "danger" },
  reactivate: { label: "Reactivate", needsReason: false, confirm: "Reactivate this vendor?", tone: "primary" },
  block: { label: "Block", needsReason: true, confirm: "Block this vendor permanently.", tone: "danger" },
};

function actionsFor(state: ApplicationDetail["state"]): ReviewAction[] {
  switch (state) {
    case "UNDER_REVIEW":
      return ["approve", "request-changes", "reject", "block"];
    case "DRAFT":
    case "DOCUMENTS_PENDING":
    case "PENDING_VERIFICATION":
      return ["reject", "block"];
    case "ACTIVE":
      return ["suspend", "block"];
    case "SUSPENDED":
      return ["reactivate", "block"];
    case "REJECTED":
      return ["block"];
    default:
      return [];
  }
}

const when = (iso: string | null | undefined) =>
  iso ? new Date(iso).toLocaleString("en-IN", { day: "numeric", month: "short", year: "numeric", hour: "2-digit", minute: "2-digit" }) : "—";

export function ApplicationReview({ vendorId }: { vendorId: string }) {
  const [app, setApp] = React.useState<ApplicationDetail | null>(null);
  const [error, setError] = React.useState("");

  React.useEffect(() => {
    getApplicationDetail(vendorId).then(setApp, (e) =>
      setError(e instanceof ApiError && e.status === 404 ? "Application not found." : e instanceof ApiError && e.status === 403 ? "You don't have permission to view this application." : "Couldn't load the application.")
    );
  }, [vendorId]);

  if (error) {
    return (
      <div className="max-w-5xl">
        <BackLink />
        <p role="alert" className="mt-6 text-sm text-[var(--sig-danger-fg)]">
          {error}
        </p>
      </div>
    );
  }
  if (!app) return <div className="max-w-5xl"><BackLink /><div className="mt-6 h-40 animate-pulse rounded-sm bg-black/[.04]" /></div>;

  const warnings = app.checks.filter((c) => c.result !== "PASS");

  return (
    <div className="max-w-5xl">
      <BackLink />
      <header className="mt-4 flex flex-col gap-4 md:flex-row md:items-start md:justify-between">
        <div>
          <div className="flex flex-wrap items-center gap-3">
            <h1 className="text-3xl font-black tracking-tight text-[var(--text-primary)]">{app.business?.businessName || app.account.fullName}</h1>
            <StateBadge state={app.state} />
          </div>
          <p className="mt-1 text-sm text-[var(--text-muted)]">
            <span className="font-mono">{app.vendorCode}</span> · registered {when(app.createdAt)}
            {app.submittedAt && <> · submitted {when(app.submittedAt)}</>}
          </p>
        </div>
      </header>

      <Decisions app={app} onDone={setApp} />

      {app.decision && (
        <p className="mt-4 text-sm text-[var(--text-secondary)]">
          Last decision: <strong>{app.decision.decision.replace("_", " ").toLowerCase()}</strong> on {when(app.decision.decidedAt)}
          {app.decision.reason && <> — “{app.decision.reason}”</>}
        </p>
      )}

      <div className="mt-8 grid gap-6 lg:grid-cols-[minmax(0,1fr)_320px]">
        <div className="space-y-6">
          <Card title={`Automated checks${warnings.length ? ` · ${warnings.length} to look at` : ""}`}>
            {app.checks.length === 0 ? (
              <p className="text-sm text-[var(--text-muted)]">Checks run when the vendor submits.</p>
            ) : (
              <ul className="space-y-2">
                {[...app.checks].sort((a, b) => rank(a.result) - rank(b.result)).map((c) => (
                  <li key={c.code} className="flex items-start gap-2.5 text-sm">
                    {c.result === "PASS" ? (
                      <CheckCircle2 aria-label="Passed" className="mt-0.5 size-4 shrink-0 text-green-600" />
                    ) : c.result === "WARN" ? (
                      <AlertTriangle aria-label="Needs attention" className="mt-0.5 size-4 shrink-0 text-amber-600" />
                    ) : (
                      <XCircle aria-label="Failed" className="mt-0.5 size-4 shrink-0 text-red-600" />
                    )}
                    <span className={c.result === "PASS" ? "text-[var(--text-secondary)]" : "font-medium text-[var(--text-primary)]"}>{c.message}</span>
                  </li>
                ))}
              </ul>
            )}
            <p className="mt-4 text-xs text-[var(--text-muted)]">
              PAN, GSTIN and bank details are not checked with an external provider. Compare them with the documents before approving.
            </p>
          </Card>

          <Card title="Business">
            {app.business ? (
              <Rows
                rows={[
                  ["Legal name", app.business.businessName],
                  ["Type", BUSINESS_TYPES.find((t) => t.value === app.business!.businessType)?.label ?? app.business.businessType],
                  ["PAN", app.business.pan, true],
                  ["GSTIN", app.business.gstin || "Not GST-registered", !!app.business.gstin],
                  ["Address", `${app.business.address}, ${app.business.city}, ${app.business.state} ${app.business.pincode}`],
                ]}
              />
            ) : (
              <Missing />
            )}
          </Card>

          <Card title="Parts and vehicles">
            {app.categories ? (
              <>
                <CategoryList items={app.categoryNames} />
                <p className="mt-3 text-sm text-[var(--text-secondary)]">
                  <span className="text-[var(--text-muted)]">Vehicles: </span>
                  {app.categories.vehicleSegments.map(vehicleSegmentLabel).join(", ")}
                </p>
              </>
            ) : (
              <Missing />
            )}
          </Card>

          <Card title="Documents">
            {app.documents.length === 0 ? (
              <Missing />
            ) : (
              <ul className="divide-y divide-[var(--border-subtle)]">
                {app.documents.map((d) => (
                  <DocumentLine key={d.id} vendorId={app.vendorId} doc={d} />
                ))}
              </ul>
            )}
            {app.missingDocuments.length > 0 && (
              <p className="mt-3 text-sm text-amber-700">Missing: {app.missingDocuments.map((m) => DOCUMENT_INFO[m].label).join(", ")}</p>
            )}
          </Card>
        </div>

        <div className="space-y-6">
          <Card title="Contact">
            <Rows
              rows={[
                ["Name", app.account.fullName],
                ["Email", `${app.account.email}${app.account.emailVerified ? " ✓" : " (unverified)"}`],
                ["Mobile", `${app.account.mobile}${app.account.mobileVerified ? " ✓" : " (unverified)"}`],
              ]}
            />
          </Card>
          <Card title="Bank account">{app.bank ? <BankBlock app={app} /> : <Missing />}</Card>
          <Card title="Declarations">
            {app.agreements.length === 0 ? (
              <p className="text-sm text-[var(--text-muted)]">Accepted at submission.</p>
            ) : (
              <ul className="space-y-1.5 text-sm text-[var(--text-secondary)]">
                {app.agreements.map((a) => (
                  <li key={a.agreement}>
                    {a.agreement.replace(/_/g, " ").toLowerCase()} <span className="text-[var(--text-muted)]">· v{a.version} · {when(a.acceptedAt)}</span>
                  </li>
                ))}
              </ul>
            )}
          </Card>
          <Card title="History">
            <ol className="space-y-3">
              {app.history.map((h, i) => (
                <li key={i} className="text-sm">
                  <p className="font-medium text-[var(--text-primary)]">
                    {HISTORY_LABELS[h.action] ?? h.action}
                    {h.documentType && <span className="font-normal text-[var(--text-muted)]"> · {DOCUMENT_INFO[h.documentType as keyof typeof DOCUMENT_INFO]?.label ?? h.documentType}</span>}
                  </p>
                  <p className="text-xs text-[var(--text-muted)]">
                    {when(h.at)}
                    {h.actorRole && h.actorRole !== "VENDOR" && <> · {h.actorName ?? h.actorRole}</>}
                  </p>
                  {h.reason && <p className="mt-0.5 text-xs text-[var(--text-secondary)]">“{h.reason}”</p>}
                </li>
              ))}
            </ol>
          </Card>
        </div>
      </div>
    </div>
  );
}

function rank(r: "PASS" | "WARN" | "FAIL") {
  return r === "FAIL" ? 0 : r === "WARN" ? 1 : 2;
}

function BackLink() {
  return (
    <Link href="/admin/vendors/applications" className="inline-flex items-center gap-1.5 text-sm text-[var(--text-muted)] hover:text-[var(--text-primary)]">
      <ArrowLeft aria-hidden className="size-4" /> Vendor applications
    </Link>
  );
}

function Card({ title, children }: { title: string; children: React.ReactNode }) {
  return (
    <section className="glass rounded-sm border border-[var(--border-color)] p-5">
      <h2 className="mb-4 text-sm font-bold text-[var(--text-primary)]">{title}</h2>
      {children}
    </section>
  );
}

function Rows({ rows }: { rows: [string, string, boolean?][] }) {
  return (
    <dl className="space-y-2 text-sm">
      {rows.map(([k, v, mono]) => (
        <div key={k} className="grid grid-cols-[96px_minmax(0,1fr)] gap-3">
          <dt className="text-[var(--text-muted)]">{k}</dt>
          <dd className={`break-words text-[var(--text-primary)] ${mono ? "font-mono" : ""}`}>{v}</dd>
        </div>
      ))}
    </dl>
  );
}

function Missing() {
  return <p className="text-sm text-[var(--text-muted)]">Not provided yet.</p>;
}

function CategoryList({ items }: { items: ApplicationDetail["categoryNames"] }) {
  const groups = new Map<string, { whole: boolean; names: string[] }>();
  for (const c of items) {
    const key = c.group ?? c.name;
    const g = groups.get(key) ?? { whole: false, names: [] };
    if (c.group) g.names.push(c.active ? c.name : `${c.name} (deactivated)`);
    else g.whole = true;
    groups.set(key, g);
  }
  return (
    <dl className="divide-y divide-[var(--border-subtle)] text-sm">
      {[...groups.entries()].map(([group, g]) => (
        <div key={group} className="grid gap-1 py-2 sm:grid-cols-[180px_minmax(0,1fr)] sm:gap-4">
          <dt className="font-semibold text-[var(--text-primary)]">{group}</dt>
          <dd className="text-[var(--text-secondary)]">{g.whole ? "All part types" : g.names.join(", ")}</dd>
        </div>
      ))}
    </dl>
  );
}

function DocumentLine({ vendorId, doc }: { vendorId: string; doc: ApplicationDetail["documents"][number] }) {
  const [busy, setBusy] = React.useState(false);
  const [err, setErr] = React.useState("");
  async function open() {
    setBusy(true);
    setErr("");
    const w = window.open("", "_blank");
    if (w) w.opener = null;
    try {
      const { url } = await reviewDocumentUrl(vendorId, doc.id);
      if (w) w.location.href = url;
    } catch {
      w?.close();
      setErr("Couldn't open the document.");
    } finally {
      setBusy(false);
    }
  }
  return (
    <li className="flex items-center justify-between gap-4 py-2.5 text-sm">
      <div className="min-w-0">
        <p className="font-medium text-[var(--text-primary)]">{DOCUMENT_INFO[doc.documentType]?.label ?? doc.label}</p>
        <p className="truncate text-xs text-[var(--text-muted)]">{doc.fileName}</p>
        {err && <p className="text-xs text-[var(--sig-danger-fg)]">{err}</p>}
      </div>
      <button
        type="button"
        onClick={open}
        disabled={busy}
        className="inline-flex shrink-0 items-center gap-1.5 rounded-sm border border-[var(--border-color)] px-3 py-1.5 text-xs font-semibold text-[var(--text-primary)] hover:border-[var(--text-primary)] disabled:opacity-50"
      >
        <ExternalLink aria-hidden className="size-3.5" /> {busy ? "Opening…" : "View"}
      </button>
    </li>
  );
}

function BankBlock({ app }: { app: ApplicationDetail }) {
  const [full, setFull] = React.useState<string | null>(null);
  const [err, setErr] = React.useState("");
  const bank = app.bank!;
  async function reveal() {
    setErr("");
    try {
      setFull((await revealAccountNumber(app.vendorId)).accountNumber);
    } catch (e) {
      setErr(e instanceof ApiError && e.status === 403 ? "Only approvers can view the full number." : "Couldn't load the account number.");
    }
  }
  return (
    <>
      <Rows
        rows={[
          ["Holder", bank.accountHolder],
          ["Bank", bank.bankName],
          ["IFSC", bank.ifsc, true],
          ["Account", full ?? `•••• ${bank.accountNumberLast4}`, true],
        ]}
      />
      {!full && (
        <button type="button" onClick={reveal} className="mt-3 inline-flex items-center gap-1.5 text-xs font-semibold text-[var(--text-secondary)] hover:text-[var(--text-primary)]">
          <Eye aria-hidden className="size-3.5" /> Show full number (recorded in history)
        </button>
      )}
      {err && <p className="mt-2 text-xs text-[var(--sig-danger-fg)]">{err}</p>}
    </>
  );
}

function Decisions({ app, onDone }: { app: ApplicationDetail; onDone: (a: ApplicationDetail) => void }) {
  const [pending, setPending] = React.useState<ReviewAction | null>(null);
  const [reason, setReason] = React.useState("");
  const [busy, setBusy] = React.useState(false);
  const [err, setErr] = React.useState("");
  const actions = actionsFor(app.state);
  if (actions.length === 0) return null;

  async function confirm() {
    if (!pending) return;
    const copy = ACTION_COPY[pending];
    if (copy.needsReason && reason.trim().length < 5) {
      setErr("Give a reason (at least 5 characters). The vendor sees it.");
      return;
    }
    setBusy(true);
    setErr("");
    try {
      onDone(await decide(app.vendorId, pending, reason.trim()));
      setPending(null);
      setReason("");
    } catch (e) {
      setErr(e instanceof ApiError ? (e.fieldErrors?.reason ?? e.message) : "Couldn't save the decision.");
    } finally {
      setBusy(false);
    }
  }

  const btn = (tone: "primary" | "danger" | "neutral") =>
    tone === "primary"
      ? "bg-[var(--accent)] text-white hover:bg-[var(--accent-hover)]"
      : tone === "danger"
        ? "border border-red-600/50 text-red-700 hover:bg-red-600 hover:text-white"
        : "border border-[var(--border-color)] text-[var(--text-primary)] hover:border-[var(--text-primary)]";

  return (
    <div className="mt-6">
      <div className="flex flex-wrap gap-2">
        {actions.map((a) => (
          <button
            key={a}
            type="button"
            onClick={() => {
              setPending(a);
              setErr("");
            }}
            aria-pressed={pending === a}
            className={`rounded-sm px-4 py-2 text-sm font-semibold transition-colors ${btn(ACTION_COPY[a].tone)}`}
          >
            {ACTION_COPY[a].label}
          </button>
        ))}
      </div>
      {pending && (
        <div className="glass mt-4 rounded-sm border border-[var(--border-color)] p-4">
          <p className="text-sm font-semibold text-[var(--text-primary)]">{ACTION_COPY[pending].confirm}</p>
          {ACTION_COPY[pending].needsReason && (
            <>
              <label htmlFor="decision-reason" className="mt-3 block text-xs font-semibold text-[var(--text-muted)]">
                Reason (sent to the vendor)
              </label>
              <textarea
                id="decision-reason"
                value={reason}
                onChange={(e) => setReason(e.target.value)}
                rows={3}
                maxLength={1000}
                className="themed-input mt-1.5 w-full rounded-sm px-3 py-2 text-sm"
              />
            </>
          )}
          {err && (
            <p role="alert" className="mt-2 text-sm text-[var(--sig-danger-fg)]">
              {err}
            </p>
          )}
          <div className="mt-3 flex gap-2">
            <button type="button" onClick={confirm} disabled={busy} className={`rounded-sm px-4 py-2 text-sm font-semibold disabled:opacity-50 ${btn(ACTION_COPY[pending].tone)}`}>
              {busy ? "Saving…" : `Confirm ${ACTION_COPY[pending].label.toLowerCase()}`}
            </button>
            <button type="button" onClick={() => setPending(null)} className="px-3 py-2 text-sm text-[var(--text-muted)] hover:text-[var(--text-primary)]">
              Cancel
            </button>
          </div>
        </div>
      )}
    </div>
  );
}
