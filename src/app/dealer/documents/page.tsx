import { getServerSession } from "next-auth";
import { redirect } from "next/navigation";
import { authOptions } from "@/lib/auth";
import { prisma } from "@/lib/prisma";
import { DocumentUploader } from "@/components/dealer/document-uploader";
import { Info, ShieldCheck } from "lucide-react";
import type { DealerDocumentType } from "@prisma/client";

const DOCUMENT_TYPES: DealerDocumentType[] = [
  "GST_CERTIFICATE",
  "PAN_CARD",
  "BUSINESS_REGISTRATION",
  "SHOP_IMAGE",
  "OTHER",
];

export default async function DealerDocumentsPage() {
  const session = await getServerSession(authOptions);
  if (!session || session.user.role !== "DEALER") redirect("/login");

  const dealer = await prisma.dealer.findUnique({
    where: { userId: session.user.id },
    include: { documents: true },
  });

  if (!dealer) redirect("/login");

  const docMap = Object.fromEntries(dealer.documents.map((d) => [d.documentType, d]));

  return (
    <div className="max-w-3xl mx-auto px-4 py-8 space-y-6">
      {/* Page header */}
      <div>
        <h1 className="text-2xl font-bold text-[var(--text-primary)]">Documents</h1>
        <p className="text-sm text-[var(--text-muted)] mt-1">
          Upload verification documents to complete your dealer profile.
        </p>
      </div>

      {/* Info banner */}
      <div className="flex items-start gap-3 rounded-sm border border-blue-500/30 bg-blue-500/10 px-4 py-3">
        <Info className="w-4 h-4 text-blue-400 flex-shrink-0 mt-0.5" />
        <div className="text-xs text-blue-300 space-y-1">
          <p className="font-medium">Document verification speeds up order approvals</p>
          <p className="text-blue-400">
            All documents are stored securely and only accessible to MOTOXPLUS admin team.
            Files are encrypted and accessible only via time-limited links.
          </p>
        </div>
      </div>

      {/* Status summary */}
      <div className="flex items-center gap-2 rounded-sm border border-[var(--border-color)] bg-[var(--bg-card)] px-4 py-3">
        <ShieldCheck className="w-5 h-5 text-[var(--text-muted)]" />
        <span className="text-sm text-[var(--text-secondary)]">
          {dealer.documents.length} of {DOCUMENT_TYPES.length} documents uploaded
        </span>
        {dealer.documents.length === DOCUMENT_TYPES.length && (
          <span className="ml-auto text-xs text-green-500 font-medium">All complete</span>
        )}
      </div>

      {/* Document uploaders */}
      <div className="space-y-3">
        {DOCUMENT_TYPES.map((docType) => {
          const existing = docMap[docType];
          return (
            <DocumentUploader
              key={docType}
              documentType={docType}
              existing={
                existing
                  ? {
                      id: existing.id,
                      documentType: existing.documentType,
                      fileName: existing.fileName,
                      fileSize: existing.fileSize,
                      uploadedAt: existing.uploadedAt.toISOString(),
                    }
                  : null
              }
            />
          );
        })}
      </div>
    </div>
  );
}
