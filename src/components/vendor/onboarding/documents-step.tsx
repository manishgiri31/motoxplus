"use client";

import * as React from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { CheckCircle2, ExternalLink, FileText, Loader2, Upload, X } from "lucide-react";
import { Button } from "@/components/ui/button";
import { cn } from "@/lib/utils";
import {
  DOCUMENT_ACCEPT,
  DOCUMENT_INFO,
  DOCUMENT_MAX_BYTES,
  DOCUMENT_ORDER,
  documentUrl,
  removeDocument,
  uploadDocument,
  type DocumentType,
  type VendorApplication,
} from "@/lib/vendor/onboarding";
import { ApiError } from "@/lib/api/client";
import { errorsFrom, useApplication } from "./application-context";
import { Banner, StepPage } from "./step-page";

export function DocumentsStep() {
  return (
    <StepPage
      title="Business and bank documents"
      description="Optional. Upload now or later from your dashboard; PDF, JPG or PNG, up to 5 MB each. Documents are stored privately and only MotoXPlus reviewers can open them. We never ask for Aadhaar."
      backHref="/vendor/onboarding/bank"
      writable={(app) => app.documentsEditable ?? app.editable}
    >
      {(app) => <DocumentList app={app} />}
    </StepPage>
  );
}

function formatSize(bytes: number) {
  return bytes >= 1024 * 1024 ? `${(bytes / 1024 / 1024).toFixed(1)} MB` : `${Math.max(1, Math.round(bytes / 1024))} KB`;
}

function DocumentList({ app }: { app: VendorApplication }) {
  const router = useRouter();
  const hasGstin = !!app.business?.gstin;
  const types = DOCUMENT_ORDER.filter((t) => t !== "GST_CERTIFICATE" || hasGstin);
  const missing = app.missingDocuments;

  return (
    <div>
      <ul className="divide-y divide-[var(--line)] border-y border-[var(--line)]">
        {types.map((t) => (
          <DocumentRow key={t} app={app} type={t} required={app.requiredDocuments.includes(t)} />
        ))}
      </ul>

      <div className="mt-10 flex flex-col-reverse items-stretch justify-between gap-4 border-t border-[var(--line)] pt-6 sm:flex-row sm:items-center">
        <Link href="/vendor/onboarding/bank" className="hidden text-sm text-[var(--muted)] hover:text-[var(--ink)] sm:inline">
          ← Back
        </Link>
        <div className="flex flex-col items-stretch gap-2 sm:items-end">
          {missing.length > 0 && app.editable && (
            <p className="text-sm text-[var(--muted)]">
              Still needed: {missing.map((m) => DOCUMENT_INFO[m].label).join(", ")}
            </p>
          )}
          <Button size="lg" disabled={missing.length > 0} onClick={() => router.push("/vendor/onboarding/review")} className="w-full sm:w-auto">
            {app.documents.length === 0 ? "Skip for now" : "Continue to review"}
          </Button>
        </div>
      </div>
    </div>
  );
}

function DocumentRow({ app, type, required }: { app: VendorApplication; type: DocumentType; required: boolean }) {
  const { set } = useApplication();
  const inputRef = React.useRef<HTMLInputElement>(null);
  const [busy, setBusy] = React.useState<"upload" | "remove" | "view" | null>(null);
  const [error, setError] = React.useState("");
  const doc = app.documents.find((d) => d.documentType === type);
  const info = DOCUMENT_INFO[type];
  const id = `doc-${type.toLowerCase()}`;

  async function onFile(file: File | undefined) {
    if (!file) return;
    setError("");
    const ext = file.name.toLowerCase().split(".").pop() ?? "";
    if (!["pdf", "jpg", "jpeg", "png"].includes(ext)) return setError("Use a PDF, JPG or PNG file");
    if (file.size === 0) return setError("This file is empty");
    if (file.size > DOCUMENT_MAX_BYTES) return setError("File is too large (max 5 MB)");
    setBusy("upload");
    try {
      set(await uploadDocument(type, file));
    } catch (e) {
      const { fields, message } = errorsFrom(e);
      // 5xx = document storage unavailable; documents are optional, so say the vendor can carry on.
      const unavailable = e instanceof ApiError && e.status >= 500;
      setError(
        fields[type] ??
          fields.documentType ??
          (unavailable ? "Document upload isn't available right now. Documents are optional: continue and upload this later." : message)
      );
    } finally {
      setBusy(null);
    }
  }

  async function view() {
    if (!doc) return;
    setBusy("view");
    // Open synchronously so the popup isn't blocked, then point it at the short-lived link.
    // ("noopener" would make window.open return null, so detach the opener by hand instead.)
    const w = window.open("", "_blank");
    if (w) w.opener = null;
    try {
      const { url } = await documentUrl(doc.id);
      if (w) w.location.href = url;
      else window.location.href = url;
    } catch (e) {
      w?.close();
      setError(errorsFrom(e).message);
    } finally {
      setBusy(null);
    }
  }

  async function remove() {
    setBusy("remove");
    setError("");
    try {
      set(await removeDocument(type));
    } catch (e) {
      setError(errorsFrom(e).message);
    } finally {
      setBusy(null);
    }
  }

  return (
    <li className="py-5">
      <div className="flex flex-col gap-4 sm:flex-row sm:items-start sm:justify-between">
        <div className="min-w-0">
          <p id={`${id}-label`} className="text-[15px] font-semibold">
            {info.label}
            <span className={cn("ml-2 text-xs font-medium", required ? "text-[var(--accent-text)]" : "text-[var(--muted)]")}>
              {required ? "Required" : "Optional"}
            </span>
          </p>
          <p className="mt-1 text-sm text-[var(--muted)]">{info.hint}</p>
          {doc && (
            <p className="mt-3 flex min-w-0 items-center gap-2 text-sm">
              <CheckCircle2 aria-hidden className="size-4 shrink-0 text-[var(--sig-success-fg,#1a7f37)]" />
              <FileText aria-hidden className="size-4 shrink-0 text-[var(--muted)]" />
              <span className="truncate">{doc.fileName}</span>
              <span className="shrink-0 text-[var(--muted)]">{formatSize(doc.fileSize)}</span>
            </p>
          )}
          {error && (
            <p role="alert" className="mt-2 text-sm font-medium text-[var(--sig-danger-fg)]">
              {error}
            </p>
          )}
        </div>

        <div className="flex shrink-0 items-center gap-2">
          <input
            ref={inputRef}
            id={id}
            type="file"
            accept={DOCUMENT_ACCEPT}
            aria-labelledby={`${id}-label`}
            className="sr-only"
            onChange={(e) => {
              onFile(e.target.files?.[0]);
              e.target.value = "";
            }}
          />
          {doc && (
            <Button type="button" variant="ghost" size="sm" onClick={view} loading={busy === "view"} icon={<ExternalLink aria-hidden />}>
              View
            </Button>
          )}
          {(app.documentsEditable ?? app.editable) && (
            <Button
              type="button"
              variant={doc ? "ghost" : "secondary"}
              size="sm"
              disabled={!!busy}
              onClick={() => inputRef.current?.click()}
              icon={busy === "upload" ? <Loader2 aria-hidden className="animate-spin" /> : <Upload aria-hidden />}
            >
              {busy === "upload" ? "Uploading…" : doc ? "Replace" : "Upload"}
            </Button>
          )}
          {doc && (app.documentsEditable ?? app.editable) && (
            <button
              type="button"
              onClick={remove}
              disabled={!!busy}
              aria-label={`Remove ${info.label}`}
              className="grid size-9 place-items-center rounded-full text-[var(--muted)] hover:bg-[var(--card)] hover:text-[var(--ink)] disabled:opacity-50"
            >
              <X aria-hidden className="size-4" />
            </button>
          )}
        </div>
      </div>
      {!app.editable && !doc && required && (
        <div className="mt-3">
          <Banner tone="info">Not uploaded.</Banner>
        </div>
      )}
    </li>
  );
}
