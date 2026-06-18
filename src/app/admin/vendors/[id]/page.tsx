import { prisma } from "@/lib/prisma";
import { notFound } from "next/navigation";
import Link from "next/link";
import { formatDate, formatCurrency } from "@/lib/utils";
import { ArrowLeft, MapPin, Phone, Mail, Globe, Building2, Star, CreditCard } from "lucide-react";
import { VendorStatusActions } from "@/components/admin/vendor-actions";
import { VendorRatingForm } from "@/components/admin/vendor-rating-form";
import { VendorPaymentForm } from "@/components/admin/vendor-payment-form";
import { VendorContactForm } from "@/components/admin/vendor-contact-form";

const STATUS_COLORS: Record<string, string> = {
  PENDING: "bg-yellow-900/20 text-yellow-400 border-yellow-900/30",
  APPROVED: "bg-green-900/20 text-green-400 border-green-900/30",
  REJECTED: "bg-red-900/20 text-red-400 border-red-900/30",
  SUSPENDED: "bg-orange-900/20 text-orange-400 border-orange-900/30",
  BLACKLISTED: "bg-purple-900/20 text-purple-400 border-purple-900/30",
};

const CATEGORY_LABELS: Record<string, string> = {
  RAW_MATERIALS: "Raw Materials",
  PACKAGING: "Packaging",
  PRINTING: "Printing",
  LOGISTICS: "Logistics",
  MANUFACTURING_COMPONENTS: "Manufacturing Components",
  TOOLING: "Tooling",
  SERVICES: "Services",
};

function StarRating({ score }: { score: number }) {
  return (
    <div className="flex items-center gap-0.5">
      {[1, 2, 3, 4, 5].map((i) => (
        <Star
          key={i}
          size={12}
          className={i <= Math.round(score) ? "text-yellow-400 fill-yellow-400" : "text-gray-700"}
        />
      ))}
      <span className="ml-1 text-sm font-bold text-[var(--text-primary)]">{score.toFixed(1)}</span>
    </div>
  );
}

export default async function VendorDetailPage({ params }: { params: { id: string } }) {
  const vendor = await prisma.vendor.findUnique({
    where: { id: params.id },
    include: {
      contacts: true,
      documents: true,
      ratings: { orderBy: { createdAt: "desc" } },
      payments: { orderBy: { paymentDate: "desc" }, take: 10 },
      user: { select: { id: true, email: true, name: true, createdAt: true } },
    },
  });

  if (!vendor) notFound();

  const avgRating =
    vendor.ratings.length > 0
      ? vendor.ratings.reduce((s, r) => s + r.overallScore, 0) / vendor.ratings.length
      : null;

  const totalPaid = vendor.payments
    .filter((p) => p.status === "PAID")
    .reduce((s, p) => s + p.amount, 0);

  const latestRating = vendor.ratings[0];

  return (
    <div className="max-w-6xl">
      {/* Header */}
      <div className="mb-8 flex items-start gap-4">
        <Link
          href="/admin/vendors"
          className="glass border border-[var(--border-color)] p-2 rounded-sm hover:border-red-900/40 transition-colors mt-1"
        >
          <ArrowLeft size={18} className="text-[var(--text-muted)]" />
        </Link>
        <div className="flex-1">
          <div className="flex items-center gap-3 flex-wrap">
            <h1 className="text-3xl font-black text-[var(--text-primary)] tracking-tight">
              {vendor.companyName}
            </h1>
            <span className={`text-xs font-semibold uppercase tracking-wider px-2.5 py-1 rounded-sm border ${STATUS_COLORS[vendor.status]}`}>
              {vendor.status}
            </span>
          </div>
          <p className="text-[var(--text-muted)] mt-1">
            {vendor.vendorCode} · {CATEGORY_LABELS[vendor.category] || vendor.category}
          </p>
        </div>
        <VendorStatusActions vendorId={vendor.id} currentStatus={vendor.status} />
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        {/* Left column */}
        <div className="lg:col-span-2 space-y-6">
          {/* Company Details */}
          <div className="glass border border-[var(--border-color)] rounded-sm p-6">
            <h2 className="text-[var(--text-primary)] font-bold text-sm uppercase tracking-widest mb-5">
              Company Details
            </h2>
            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              <InfoRow icon={Building2} label="Owner" value={vendor.ownerName} />
              <InfoRow icon={Mail} label="Email" value={vendor.email} />
              <InfoRow icon={Phone} label="Phone" value={vendor.phone} />
              <InfoRow
                icon={MapPin}
                label="Location"
                value={`${vendor.address}, ${vendor.city}, ${vendor.state} — ${vendor.pincode}`}
              />
              {vendor.gstNumber && (
                <InfoRow icon={Building2} label="GST" value={vendor.gstNumber} mono />
              )}
              {vendor.panNumber && (
                <InfoRow icon={Building2} label="PAN" value={vendor.panNumber} mono />
              )}
              {vendor.website && (
                <div className="flex items-start gap-3">
                  <Globe size={14} className="text-[var(--text-muted)] mt-0.5 flex-shrink-0" />
                  <div>
                    <div className="text-[var(--text-muted)] text-xs uppercase tracking-wider mb-0.5">Website</div>
                    <a href={vendor.website} target="_blank" rel="noopener noreferrer" className="text-sm text-red-400 hover:text-red-300">
                      {vendor.website}
                    </a>
                  </div>
                </div>
              )}
              <InfoRow icon={CreditCard} label="Credit Days" value={`${vendor.creditDays} days`} />
            </div>

            {vendor.notes && (
              <div className="mt-5 pt-5 border-t border-[var(--border-color)]">
                <div className="text-[var(--text-muted)] text-xs uppercase tracking-wider mb-2">Notes</div>
                <p className="text-[var(--text-secondary)] text-sm whitespace-pre-wrap">{vendor.notes}</p>
              </div>
            )}
          </div>

          {/* Bank Details */}
          {(vendor.bankName || vendor.accountNumber || vendor.ifscCode) && (
            <div className="glass border border-[var(--border-color)] rounded-sm p-6">
              <h2 className="text-[var(--text-primary)] font-bold text-sm uppercase tracking-widest mb-5">
                Bank Details
              </h2>
              <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
                {vendor.bankName && <InfoRow icon={Building2} label="Bank" value={vendor.bankName} />}
                {vendor.accountNumber && (
                  <InfoRow icon={CreditCard} label="Account" value={vendor.accountNumber} mono />
                )}
                {vendor.ifscCode && (
                  <InfoRow icon={CreditCard} label="IFSC" value={vendor.ifscCode} mono />
                )}
              </div>
            </div>
          )}

          {/* Contacts */}
          <div className="glass border border-[var(--border-color)] rounded-sm p-6">
            <div className="flex items-center justify-between mb-5">
              <h2 className="text-[var(--text-primary)] font-bold text-sm uppercase tracking-widest">
                Contacts
              </h2>
              <VendorContactForm vendorId={vendor.id} />
            </div>
            {vendor.contacts.length === 0 ? (
              <p className="text-[var(--text-muted)] text-sm">No contacts added yet.</p>
            ) : (
              <div className="space-y-3">
                {vendor.contacts.map((c) => (
                  <div
                    key={c.id}
                    className="flex items-start justify-between p-3 glass border border-[var(--border-color)] rounded-sm"
                  >
                    <div>
                      <div className="flex items-center gap-2">
                        <span className="text-[var(--text-primary)] text-sm font-bold">{c.name}</span>
                        {c.isPrimary && (
                          <span className="text-[10px] text-green-400 bg-green-900/20 px-1.5 py-0.5 rounded-sm uppercase tracking-wider">
                            Primary
                          </span>
                        )}
                      </div>
                      {c.designation && (
                        <div className="text-[var(--text-muted)] text-xs">{c.designation}</div>
                      )}
                      <div className="text-[var(--text-muted)] text-xs mt-1">
                        {c.phone}{c.email && ` · ${c.email}`}
                      </div>
                    </div>
                  </div>
                ))}
              </div>
            )}
          </div>

          {/* Payments */}
          <div className="glass border border-[var(--border-color)] rounded-sm p-6">
            <div className="flex items-center justify-between mb-5">
              <div>
                <h2 className="text-[var(--text-primary)] font-bold text-sm uppercase tracking-widest">
                  Payment History
                </h2>
                <p className="text-[var(--text-muted)] text-xs mt-0.5">
                  Total paid: {formatCurrency(totalPaid)}
                </p>
              </div>
              <VendorPaymentForm vendorId={vendor.id} />
            </div>
            {vendor.payments.length === 0 ? (
              <p className="text-[var(--text-muted)] text-sm">No payments recorded.</p>
            ) : (
              <div className="space-y-2">
                {vendor.payments.map((p) => (
                  <div
                    key={p.id}
                    className="flex items-center justify-between p-3 glass border border-[var(--border-color)] rounded-sm"
                  >
                    <div>
                      <div className="text-[var(--text-primary)] text-sm font-bold">
                        {formatCurrency(p.amount)}
                      </div>
                      <div className="text-[var(--text-muted)] text-xs">
                        {p.paymentMode}
                        {p.referenceNumber && ` · ${p.referenceNumber}`}
                      </div>
                    </div>
                    <div className="text-right">
                      <div className="text-[var(--text-muted)] text-xs">{formatDate(p.paymentDate)}</div>
                      <span className={`text-[10px] font-semibold uppercase px-1.5 py-0.5 rounded-sm ${
                        p.status === "PAID" ? "bg-green-900/20 text-green-400" : "bg-yellow-900/20 text-yellow-400"
                      }`}>
                        {p.status}
                      </span>
                    </div>
                  </div>
                ))}
              </div>
            )}
          </div>
        </div>

        {/* Right column */}
        <div className="space-y-6">
          {/* Performance Card */}
          <div className="glass border border-[var(--border-color)] rounded-sm p-6">
            <h2 className="text-[var(--text-primary)] font-bold text-sm uppercase tracking-widest mb-5">
              Performance
            </h2>
            {avgRating !== null ? (
              <div className="space-y-4">
                <div className="text-center py-3">
                  <div className="text-5xl font-black text-[var(--text-primary)] mb-1">
                    {avgRating.toFixed(1)}
                  </div>
                  <StarRating score={avgRating} />
                  <div className="text-[var(--text-muted)] text-xs mt-2">
                    Based on {vendor.ratings.length} {vendor.ratings.length === 1 ? "review" : "reviews"}
                  </div>
                </div>
                {latestRating && (
                  <div className="space-y-2 pt-4 border-t border-[var(--border-color)]">
                    <div className="text-[var(--text-muted)] text-[10px] uppercase tracking-wider mb-3">
                      Latest: {latestRating.period}
                    </div>
                    {[
                      { label: "Quality", score: latestRating.qualityScore },
                      { label: "Delivery", score: latestRating.deliveryScore },
                      { label: "Pricing", score: latestRating.priceScore },
                    ].map(({ label, score }) => (
                      <div key={label} className="flex items-center justify-between">
                        <span className="text-[var(--text-muted)] text-xs">{label}</span>
                        <StarRating score={score} />
                      </div>
                    ))}
                  </div>
                )}
              </div>
            ) : (
              <p className="text-[var(--text-muted)] text-sm text-center py-4">
                No ratings yet
              </p>
            )}
            <div className="mt-4 pt-4 border-t border-[var(--border-color)]">
              <VendorRatingForm vendorId={vendor.id} />
            </div>
          </div>

          {/* Portal Access */}
          <div className="glass border border-[var(--border-color)] rounded-sm p-6">
            <h2 className="text-[var(--text-primary)] font-bold text-sm uppercase tracking-widest mb-4">
              Portal Access
            </h2>
            {vendor.user ? (
              <div>
                <div className="flex items-center gap-2 mb-2">
                  <div className="w-2 h-2 rounded-full bg-green-400" />
                  <span className="text-green-400 text-xs font-semibold uppercase tracking-wider">Active</span>
                </div>
                <div className="text-[var(--text-primary)] text-sm font-bold">{vendor.user.name}</div>
                <div className="text-[var(--text-muted)] text-xs">{vendor.user.email}</div>
                <div className="text-gray-600 text-xs mt-1">
                  Since {formatDate(vendor.user.createdAt)}
                </div>
              </div>
            ) : (
              <div>
                <div className="flex items-center gap-2 mb-3">
                  <div className="w-2 h-2 rounded-full bg-gray-600" />
                  <span className="text-[var(--text-muted)] text-xs font-semibold uppercase tracking-wider">
                    No portal access
                  </span>
                </div>
                <p className="text-[var(--text-muted)] text-xs">
                  This vendor cannot log in yet. Edit the vendor to grant portal access.
                </p>
              </div>
            )}
          </div>

          {/* Quick Stats */}
          <div className="glass border border-[var(--border-color)] rounded-sm p-6">
            <h2 className="text-[var(--text-primary)] font-bold text-sm uppercase tracking-widest mb-4">
              Quick Stats
            </h2>
            <div className="space-y-3">
              <div className="flex justify-between">
                <span className="text-[var(--text-muted)] text-xs">Total Payments</span>
                <span className="text-[var(--text-primary)] text-sm font-bold">{vendor.payments.length}</span>
              </div>
              <div className="flex justify-between">
                <span className="text-[var(--text-muted)] text-xs">Total Paid</span>
                <span className="text-green-400 text-sm font-bold">{formatCurrency(totalPaid)}</span>
              </div>
              <div className="flex justify-between">
                <span className="text-[var(--text-muted)] text-xs">Rating Periods</span>
                <span className="text-[var(--text-primary)] text-sm font-bold">{vendor.ratings.length}</span>
              </div>
              <div className="flex justify-between">
                <span className="text-[var(--text-muted)] text-xs">Credit Terms</span>
                <span className="text-[var(--text-primary)] text-sm font-bold">{vendor.creditDays} days</span>
              </div>
              <div className="flex justify-between">
                <span className="text-[var(--text-muted)] text-xs">Registered</span>
                <span className="text-[var(--text-primary)] text-sm font-bold">{formatDate(vendor.createdAt)}</span>
              </div>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
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
        <div className={`text-[var(--text-primary)] text-sm font-medium ${mono ? "font-mono" : ""}`}>
          {value}
        </div>
      </div>
    </div>
  );
}
