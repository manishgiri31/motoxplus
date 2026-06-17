"use client";

import { useCallback, useRef, useState } from "react";
import { CheckCircle2, FileText, Loader2, Upload, X } from "lucide-react";
import type { DealerDocumentType } from "@prisma/client";

const DOC_LABELS: Record<DealerDocumentType, { label: string; hint: string }> = {
  GST_CERTIFICATE: { label: "GST Certificate", hint: "PDF, JPG or PNG — max 10 MB" },
  PAN_CARD: { label: "PAN Card", hint: "PDF, JPG or PNG — max 10 MB" },
  BUSINESS_REGISTRATION: { label: "Business Registration", hint: "PDF, JPG or PNG — max 10 MB" },
  SHOP_IMAGE: { label: "Shop / Showroom Image", hint: "JPG or PNG — max 10 MB" },
  OTHER: { label: "Other Document", hint: "PDF, JPG or PNG — max 10 MB" },
};

interface ExistingDoc {
  id: string;
  documentType: DealerDocumentType;
  fileName: string;
  fileSize: number;
  uploadedAt: string;
}

interface Props {
  documentType: DealerDocumentType;
  existing?: ExistingDoc | null;
  onUploaded?: (doc: { id: string; documentType: DealerDocumentType; fileName: string }) => void;
}

type Status = "idle" | "uploading" | "success" | "error";

function formatBytes(bytes: number): string {
  if (bytes < 1024) return `${bytes} B`;
  if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(1)} KB`;
  return `${(bytes / (1024 * 1024)).toFixed(1)} MB`;
}

export function DocumentUploader({ documentType, existing, onUploaded }: Props) {
  const [status, setStatus] = useState<Status>("idle");
  const [error, setError] = useState<string>("");
  const [uploadedDoc, setUploadedDoc] = useState<ExistingDoc | null>(existing ?? null);
  const fileInputRef = useRef<HTMLInputElement>(null);
  const { label, hint } = DOC_LABELS[documentType];

  const handleFile = useCallback(
    async (file: File) => {
      setStatus("uploading");
      setError("");

      const fd = new FormData();
      fd.append("file", file);
      fd.append("documentType", documentType);

      try {
        const res = await fetch("/api/upload/dealer-document", { method: "POST", body: fd });
        const data = await res.json();

        if (!res.ok) throw new Error(data.error || "Upload failed");

        const doc: ExistingDoc = {
          id: data.id,
          documentType,
          fileName: file.name,
          fileSize: file.size,
          uploadedAt: new Date().toISOString(),
        };
        setUploadedDoc(doc);
        setStatus("success");
        onUploaded?.({ id: data.id, documentType, fileName: file.name });
      } catch (err: any) {
        setError(err.message || "Upload failed");
        setStatus("error");
      }
    },
    [documentType, onUploaded]
  );

  const onInputChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (file) handleFile(file);
    e.target.value = "";
  };

  const onDrop = (e: React.DragEvent) => {
    e.preventDefault();
    const file = e.dataTransfer.files[0];
    if (file) handleFile(file);
  };

  return (
    <div className="rounded-sm border border-[var(--border-color)] overflow-hidden">
      {/* Header */}
      <div className="px-4 py-3 bg-[var(--bg-card)] border-b border-[var(--border-color)] flex items-center justify-between">
        <div className="flex items-center gap-2">
          <FileText className="w-4 h-4 text-[var(--text-muted)]" />
          <span className="text-sm font-medium text-[var(--text-primary)]">{label}</span>
        </div>
        {uploadedDoc && (
          <span className="flex items-center gap-1 text-xs text-green-500">
            <CheckCircle2 className="w-3.5 h-3.5" />
            Uploaded
          </span>
        )}
      </div>

      <div className="p-4 bg-[var(--bg-secondary)]">
        {/* Existing doc info */}
        {uploadedDoc && (
          <div className="mb-3 flex items-center justify-between rounded-sm bg-[var(--bg-card)] border border-[var(--border-color)] px-3 py-2">
            <div>
              <p className="text-xs font-medium text-[var(--text-primary)] truncate max-w-[200px]">
                {uploadedDoc.fileName}
              </p>
              <p className="text-xs text-[var(--text-muted)]">
                {formatBytes(uploadedDoc.fileSize)} ·{" "}
                {new Date(uploadedDoc.uploadedAt).toLocaleDateString("en-IN")}
              </p>
            </div>
            <button
              type="button"
              onClick={() => fileInputRef.current?.click()}
              className="text-xs text-red-500 hover:text-red-400 font-medium ml-3 flex-shrink-0"
            >
              Replace
            </button>
          </div>
        )}

        {/* Drop zone */}
        <div
          onDragOver={(e) => e.preventDefault()}
          onDrop={onDrop}
          onClick={() => fileInputRef.current?.click()}
          className="border-2 border-dashed border-[var(--border-color)] rounded-sm p-5 text-center cursor-pointer hover:border-red-600/60 hover:bg-[var(--bg-card-hover)] transition-colors"
        >
          <input
            ref={fileInputRef}
            type="file"
            accept="application/pdf,image/jpeg,image/jpg,image/png"
            className="hidden"
            onChange={onInputChange}
          />

          {status === "uploading" ? (
            <div className="flex flex-col items-center gap-2">
              <Loader2 className="w-6 h-6 text-red-500 animate-spin" />
              <p className="text-sm text-[var(--text-muted)]">Uploading...</p>
            </div>
          ) : (
            <div className="flex flex-col items-center gap-1">
              <Upload className="w-6 h-6 text-[var(--text-muted)]" />
              <p className="text-sm text-[var(--text-secondary)]">
                {uploadedDoc ? "Drop to replace" : "Drop file or click to upload"}
              </p>
              <p className="text-xs text-[var(--text-muted)]">{hint}</p>
            </div>
          )}
        </div>

        {/* Error */}
        {status === "error" && error && (
          <div className="mt-2 flex items-start gap-2 rounded-sm bg-red-500/10 border border-red-500/30 px-3 py-2">
            <X className="w-4 h-4 text-red-400 flex-shrink-0 mt-0.5" />
            <p className="text-xs text-red-400">{error}</p>
          </div>
        )}

        {/* Success flash */}
        {status === "success" && (
          <div className="mt-2 flex items-center gap-2 rounded-sm bg-green-500/10 border border-green-500/30 px-3 py-2">
            <CheckCircle2 className="w-4 h-4 text-green-400" />
            <p className="text-xs text-green-400">Uploaded successfully</p>
          </div>
        )}
      </div>
    </div>
  );
}
