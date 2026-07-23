import { prisma } from "@/lib/prisma";
import { notFound } from "next/navigation";
import Link from "next/link";
import { formatDate } from "@/lib/utils";
import { ArrowLeft, Building2, Mail, Phone, MapPin, FileText, CheckCircle2, XCircle, ShoppingBag, Calendar } from "lucide-react";
import { AdminDealerActions } from "@/components/admin/dealer-actions";
import { GstVerifyButton } from "@/components/admin/gst-verify-button";
import { DocumentViewButton } from "@/components/admin/document-view-button";

const STATUS_COLORS: Record<string, string> = {
  PENDING: "bg-yellow-900/20 text-yellow-400 border-yellow-900/30",
  ACTIVE: "bg-green-900/20 text-green-400 border-green-900/30",
  REJECTED: "bg-red-900/20 text-red-400 border-red-900/30",
  SUSPENDED: "bg-orange-900/20 text-orange-400 border-orange-900/30",
};

const DOCUMENT_LABELS: Record<string, string> = {
  GST_CERTIFICATE: "GST Certificate",
  PAN_CARD: "PAN Card",
  BUSINESS_REGISTRATION: "Business Registration",
  SHOP_IMAGE: "Shop / Showroom Image",
  OTHER: "Other Document",
};

function formatBytes(bytes: number): string {
  if (bytes < 1024) return `${bytes} B`;
  if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(1)} KB`;
  return `${(bytes / (1024 * 1024)).toFixed(1)} MB`;
}

function InfoRow({
  icon: Icon,
  label,
  value,
  mono = false,
}: {
  icon: any;
  label: string;
  value: string;
  mono?: boolean;
}) {
  return (
    <div className="flex items-start gap-3">
      <Icon size={14} className="text-[var(--text-muted)] mt-0.5 flex-shrink-0" />
      <div>
        <div className="text-[var(--text-muted)] text-xs uppercase tracking-wider mb-0.5">{label}</div>
        <div className={`text-[var(--text-primary)] text-sm font-medium ${mono ? "font-mono" : ""}`}>{value}</div>
      </div>
    </div>
  );
}

export default async function DealerDetailPage(props: { params: Promise<{ id: string }> }) {
  const params = await props.params;
  const dealer = await prisma.dealer.findUnique({
    where: { id: params.id },
    include: {
      user: true,
      documents: { orderBy: { uploadedAt: "desc" } },
      _count: { select: { orders: true } },
    },
  });

  if (!dealer) notFound();

  return (
    <div className="max-w-6xl">
      {/* Header */}
      <div className="mb-8 flex items-start gap-4">
        <Link
          href="/admin/dealers"
          className="glass border border-[var(--border-color)] p-2 rounded-sm hover:border-red-900/40 transition-colors mt-1"
        >
          <ArrowLeft size={18} className="text-[var(--text-muted)]" />
        </Link>
        <div className="flex-1">
          <div className="flex items-center gap-3 flex-wrap">
            <h1 className="text-3xl font-black text-[var(--text-primary)] tracking-tight">{dealer.companyName}</h1>
            <span className={`text-xs font-semibold uppercase tracking-wider px-2.5 py-1 rounded-sm border ${STATUS_COLORS[dealer.status] || "bg-gray-900/20 text-[var(--text-muted)] border-[var(--border-color)]"}`}>
              {dealer.status}
            </span>
          </div>
          <p className="text-[var(--text-muted)] mt-1">{dealer.ownerName}</p>
        </div>
        <AdminDealerActions dealerId={dealer.id} currentStatus={dealer.status} />
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        {/* Left column */}
        <div className="lg:col-span-2 space-y-6">
          {/* Company Details */}
          <div className="glass border border-[var(--border-color)] rounded-sm p-6">
            <h2 className="text-[var(--text-primary)] font-bold text-sm uppercase tracking-widest mb-5">Company Details</h2>
            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              <InfoRow icon={Building2} label="Company Name" value={dealer.companyName} />
              <InfoRow icon={Building2} label="Owner Name" value={dealer.ownerName} />
              <InfoRow icon={Mail} label="Email" value={dealer.user.email} />
              <InfoRow icon={Phone} label="Mobile" value={dealer.phone} />
              <div className="flex items-start gap-3">
                <Building2 size={14} className="text-[var(--text-muted)] mt-0.5 flex-shrink-0" />
                <div>
                  <div className="text-[var(--text-muted)] text-xs uppercase tracking-wider mb-0.5">GST</div>
                  <div className="flex items-center gap-2">
                    <span className="text-[var(--text-primary)] text-sm font-medium font-mono">{dealer.gstNumber || "Not provided"}</span>
                    <GstVerifyButton entity="dealers" id={dealer.id} gstNumber={dealer.gstNumber} gstVerified={dealer.gstVerified} />
                  </div>
                </div>
              </div>
              <InfoRow
                icon={MapPin}
                label="Address"
                value={[dealer.address || dealer.shopAddress || dealer.companyAddress, dealer.city, dealer.state, dealer.pincode].filter(Boolean).join(", ")}
              />
            </div>
          </div>

          {/* Uploaded Documents */}
          <div className="glass border border-[var(--border-color)] rounded-sm p-6">
            <h2 className="text-[var(--text-primary)] font-bold text-sm uppercase tracking-widest mb-5">Uploaded Documents</h2>
            {dealer.documents.length === 0 ? (
              <p className="text-[var(--text-muted)] text-sm">No documents uploaded yet.</p>
            ) : (
              <div className="space-y-2">
                {dealer.documents.map((doc) => (
                  <div key={doc.id} className="flex items-center justify-between p-3 glass border border-[var(--border-color)] rounded-sm">
                    <div className="flex items-center gap-3">
                      <FileText size={16} className="text-[var(--text-muted)]" />
                      <div>
                        <div className="text-[var(--text-primary)] text-sm font-bold">{DOCUMENT_LABELS[doc.documentType] || doc.documentType}</div>
                        <div className="text-[var(--text-muted)] text-xs">
                          {doc.fileName} · {formatBytes(doc.fileSize)} · {formatDate(doc.uploadedAt)}
                        </div>
                      </div>
                    </div>
                    <DocumentViewButton documentId={doc.id} />
                  </div>
                ))}
              </div>
            )}
          </div>
        </div>

        {/* Right column */}
        <div className="space-y-6">
          {/* Verification Status */}
          <div className="glass border border-[var(--border-color)] rounded-sm p-6">
            <h2 className="text-[var(--text-primary)] font-bold text-sm uppercase tracking-widest mb-4">Verification Status</h2>
            <div className="space-y-3">
              <div className="flex items-center justify-between">
                <span className="text-[var(--text-muted)] text-xs">Email</span>
                <span className={`inline-flex items-center gap-1 text-xs font-semibold ${dealer.user.emailVerified ? "text-green-400" : "text-gray-600"}`}>
                  {dealer.user.emailVerified ? <CheckCircle2 size={13} /> : <XCircle size={13} />}
                  {dealer.user.emailVerified ? "Verified" : "Unverified"}
                </span>
              </div>
              <div className="flex items-center justify-between">
                <span className="text-[var(--text-muted)] text-xs">Mobile</span>
                <span className={`inline-flex items-center gap-1 text-xs font-semibold ${dealer.user.mobileVerified ? "text-green-400" : "text-gray-600"}`}>
                  {dealer.user.mobileVerified ? <CheckCircle2 size={13} /> : <XCircle size={13} />}
                  {dealer.user.mobileVerified ? "Verified" : "Unverified"}
                </span>
              </div>
              <div className="flex items-center justify-between">
                <span className="text-[var(--text-muted)] text-xs">GST</span>
                <span className={`inline-flex items-center gap-1 text-xs font-semibold ${dealer.gstVerified ? "text-green-400" : "text-gray-600"}`}>
                  {dealer.gstVerified ? <CheckCircle2 size={13} /> : <XCircle size={13} />}
                  {dealer.gstVerified ? "Verified" : "Unverified"}
                </span>
              </div>
            </div>
          </div>

          {/* Quick Stats */}
          <div className="glass border border-[var(--border-color)] rounded-sm p-6">
            <h2 className="text-[var(--text-primary)] font-bold text-sm uppercase tracking-widest mb-4">Quick Stats</h2>
            <div className="space-y-3">
              <div className="flex items-center justify-between">
                <span className="text-[var(--text-muted)] text-xs flex items-center gap-1.5"><ShoppingBag size={12} /> Orders</span>
                <span className="text-[var(--text-primary)] text-sm font-bold">{dealer._count.orders}</span>
              </div>
              <div className="flex items-center justify-between">
                <span className="text-[var(--text-muted)] text-xs flex items-center gap-1.5"><Calendar size={12} /> Created</span>
                <span className="text-[var(--text-primary)] text-sm font-bold">{formatDate(dealer.createdAt)}</span>
              </div>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}
