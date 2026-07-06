import { prisma } from "@/lib/prisma";

import Link from "next/link";
import { VendorStatusActions } from "@/components/admin/vendor-actions";
import { GstVerifyButton } from "@/components/admin/gst-verify-button";
import { Plus, Star, CheckCircle2, XCircle } from "lucide-react";

const STATUS_COLORS: Record<string, string> = {
  PENDING: "bg-yellow-900/20 text-yellow-400",
  APPROVED: "bg-green-900/20 text-green-400",
  REJECTED: "bg-red-900/20 text-red-400",
  SUSPENDED: "bg-orange-900/20 text-orange-400",
  BLACKLISTED: "bg-purple-900/20 text-purple-400",
};

const CATEGORY_LABELS: Record<string, string> = {
  RAW_MATERIALS: "Raw Materials",
  PACKAGING: "Packaging",
  PRINTING: "Printing",
  LOGISTICS: "Logistics",
  MANUFACTURING_COMPONENTS: "Mfg Components",
  TOOLING: "Tooling",
  SERVICES: "Services",
};

const ALL_STATUSES = ["PENDING", "APPROVED", "REJECTED", "SUSPENDED", "BLACKLISTED"];

export default async function AdminVendorsPage({
  searchParams,
}: {
  searchParams: { status?: string; category?: string; page?: string };
}) {
  const page = parseInt(searchParams.page || "1");
  const pageSize = 20;

  const where: any = {};
  if (searchParams.status) where.status = searchParams.status;
  if (searchParams.category) where.category = searchParams.category;

  const [vendors, total, counts] = await Promise.all([
    prisma.vendor.findMany({
      where,
      include: {
        contacts: { where: { isPrimary: true }, take: 1 },
        ratings: { select: { overallScore: true } },
        _count: { select: { payments: true } },
        user: { select: { emailVerified: true, mobileVerified: true } },
      },
      orderBy: { createdAt: "desc" },
      skip: (page - 1) * pageSize,
      take: pageSize,
    }),
    prisma.vendor.count({ where }),
    prisma.vendor.groupBy({ by: ["status"], _count: true }),
  ]);

  const totalPages = Math.ceil(total / pageSize);
  const pendingCount = counts.find((c) => c.status === "PENDING")?._count ?? 0;

  return (
    <div>
      <div className="mb-8 flex items-center justify-between">
        <div>
          <h1 className="text-3xl font-black text-[var(--text-primary)] tracking-tight">Vendors</h1>
          <p className="text-[var(--text-muted)] mt-1">
            {total} total · {pendingCount} pending approval
          </p>
        </div>
        <Link
          href="/admin/vendors/new"
          className="flex items-center gap-2 bg-red-600 hover:bg-red-700 text-white font-bold px-4 py-2.5 rounded-sm text-sm transition-colors uppercase tracking-wider"
        >
          <Plus size={16} />
          Add Vendor
        </Link>
      </div>

      {/* Status filters */}
      <div className="flex flex-wrap gap-2 mb-4">
        <Link
          href="/admin/vendors"
          className={`px-3 py-2 rounded-sm text-xs font-semibold uppercase tracking-wider transition-colors ${
            !searchParams.status
              ? "bg-red-600 text-white"
              : "glass border border-[var(--border-color)] text-[var(--text-muted)] hover:border-red-600/50"
          }`}
        >
          All
        </Link>
        {ALL_STATUSES.map((s) => (
          <Link
            key={s}
            href={`/admin/vendors?status=${s}`}
            className={`px-3 py-2 rounded-sm text-xs font-semibold uppercase tracking-wider transition-colors ${
              searchParams.status === s
                ? "bg-red-600 text-white"
                : "glass border border-[var(--border-color)] text-[var(--text-muted)] hover:border-red-600/50"
            }`}
          >
            {s}
          </Link>
        ))}
      </div>

      <div className="glass border border-[var(--border-color)] rounded-sm overflow-hidden">
        <table className="w-full">
          <thead>
            <tr className="border-b border-[var(--border-color)]">
              <th className="px-4 py-3 text-left text-xs text-[var(--text-muted)] uppercase tracking-widest">Company</th>
              <th className="px-4 py-3 text-left text-xs text-[var(--text-muted)] uppercase tracking-widest hidden md:table-cell">Code</th>
              <th className="px-4 py-3 text-left text-xs text-[var(--text-muted)] uppercase tracking-widest hidden lg:table-cell">GST</th>
              <th className="px-4 py-3 text-left text-xs text-[var(--text-muted)] uppercase tracking-widest hidden lg:table-cell">Category</th>
              <th className="px-4 py-3 text-left text-xs text-[var(--text-muted)] uppercase tracking-widest hidden lg:table-cell">Location</th>
              <th className="px-4 py-3 text-left text-xs text-[var(--text-muted)] uppercase tracking-widest hidden md:table-cell">Rating</th>
              <th className="px-4 py-3 text-left text-xs text-[var(--text-muted)] uppercase tracking-widest">Status</th>
              <th className="px-4 py-3 text-left text-xs text-[var(--text-muted)] uppercase tracking-widest">Actions</th>
            </tr>
          </thead>
          <tbody className="divide-y divide-white/5">
            {vendors.length === 0 ? (
              <tr>
                <td colSpan={7} className="px-4 py-16 text-center text-[var(--text-muted)] text-sm">
                  No vendors found
                </td>
              </tr>
            ) : (
              vendors.map((vendor) => {
                const avgRating =
                  vendor.ratings.length > 0
                    ? vendor.ratings.reduce((s, r) => s + r.overallScore, 0) / vendor.ratings.length
                    : null;

                return (
                  <tr key={vendor.id} className="hover:bg-white/2 transition-colors">
                    <td className="px-4 py-4">
                      <Link href={`/admin/vendors/${vendor.id}`}>
                        <div className="text-[var(--text-primary)] font-bold text-sm hover:text-red-400 transition-colors">
                          {vendor.companyName}
                        </div>
                        <div className="text-[var(--text-muted)] text-xs">{vendor.ownerName}</div>
                        <div className="text-gray-600 text-xs">{vendor.email}</div>
                      </Link>
                    </td>
                    <td className="px-4 py-4 hidden md:table-cell">
                      <span className="text-[var(--text-muted)] text-xs font-mono">{vendor.vendorCode}</span>
                      {vendor.user && (
                        <div className="flex items-center gap-2 mt-1">
                          <span className={`inline-flex items-center gap-1 text-[10px] ${vendor.user.emailVerified ? "text-green-400" : "text-gray-600"}`} title="Email verified">
                            {vendor.user.emailVerified ? <CheckCircle2 size={11} /> : <XCircle size={11} />} Email
                          </span>
                          <span className={`inline-flex items-center gap-1 text-[10px] ${vendor.user.mobileVerified ? "text-green-400" : "text-gray-600"}`} title="Mobile verified">
                            {vendor.user.mobileVerified ? <CheckCircle2 size={11} /> : <XCircle size={11} />} Mobile
                          </span>
                        </div>
                      )}
                    </td>
                    <td className="px-4 py-4 hidden lg:table-cell">
                      <div className="flex flex-col gap-1">
                        <span className="text-[var(--text-muted)] text-xs font-mono">{vendor.gstNumber || "Not provided"}</span>
                        <GstVerifyButton entity="vendors" id={vendor.id} gstNumber={vendor.gstNumber} gstVerified={vendor.gstVerified} />
                      </div>
                    </td>
                    <td className="px-4 py-4 hidden lg:table-cell">
                      <span className="text-[var(--text-muted)] text-xs">
                        {CATEGORY_LABELS[vendor.category] || vendor.category}
                      </span>
                    </td>
                    <td className="px-4 py-4 hidden lg:table-cell">
                      <span className="text-[var(--text-muted)] text-xs">{vendor.city}, {vendor.state}</span>
                    </td>
                    <td className="px-4 py-4 hidden md:table-cell">
                      {avgRating !== null ? (
                        <div className="flex items-center gap-1">
                          <Star size={12} className="text-yellow-400 fill-yellow-400" />
                          <span className="text-[var(--text-primary)] text-sm font-bold">
                            {avgRating.toFixed(1)}
                          </span>
                        </div>
                      ) : (
                        <span className="text-gray-700 text-xs">—</span>
                      )}
                    </td>
                    <td className="px-4 py-4">
                      <span className={`text-xs font-semibold uppercase tracking-wider px-2 py-1 rounded-sm ${STATUS_COLORS[vendor.status] || "bg-gray-900/20 text-[var(--text-muted)]"}`}>
                        {vendor.status}
                      </span>
                    </td>
                    <td className="px-4 py-4">
                      <VendorStatusActions vendorId={vendor.id} currentStatus={vendor.status} />
                    </td>
                  </tr>
                );
              })
            )}
          </tbody>
        </table>
      </div>

      {totalPages > 1 && (
        <div className="flex items-center justify-center gap-2 mt-8">
          {Array.from({ length: totalPages }, (_, i) => i + 1).map((p) => (
            <Link
              key={p}
              href={`/admin/vendors?page=${p}${searchParams.status ? `&status=${searchParams.status}` : ""}`}
              className={`w-10 h-10 flex items-center justify-center rounded-sm text-sm font-bold ${
                p === page
                  ? "bg-red-600 text-white"
                  : "glass border border-[var(--border-color)] text-[var(--text-muted)]"
              }`}
            >
              {p}
            </Link>
          ))}
        </div>
      )}
    </div>
  );
}
