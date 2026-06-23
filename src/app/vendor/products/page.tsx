import { getServerSession } from "next-auth";
import { authOptions } from "@/lib/auth";
import { prisma } from "@/lib/prisma";
import { redirect } from "next/navigation";
import Link from "next/link";
import { formatCurrency, formatDate } from "@/lib/utils";
import { Package, Plus, Clock, CheckCircle } from "lucide-react";

export default async function VendorProductsPage() {
  const session = await getServerSession(authOptions);
  if (!session || session.user.role !== "VENDOR") redirect("/login");

  const vendor = await prisma.vendor.findUnique({
    where: { userId: session.user.id },
    include: {
      products: {
        include: { category: true },
        orderBy: { createdAt: "desc" },
      },
    },
  });
  if (!vendor) redirect("/login");

  const statusIcon: Record<string, React.ReactNode> = {
    true: <CheckCircle size={14} className="text-green-400" />,
    false: <Clock size={14} className="text-yellow-400" />,
  };

  return (
    <div>
      <div className="flex items-center justify-between mb-8">
        <div>
          <h1 className="text-3xl font-black text-[var(--text-primary)] tracking-tight">My Products</h1>
          <p className="text-[var(--text-muted)] text-sm mt-1">Products you&apos;ve submitted for listing</p>
        </div>
        {vendor.status === "APPROVED" && (
          <Link
            href="/vendor/products/new"
            className="flex items-center gap-2 bg-amber-600 hover:bg-amber-700 text-white font-bold px-5 py-3 rounded-xl transition-colors text-sm uppercase tracking-wider"
          >
            <Plus size={16} />
            Submit Product
          </Link>
        )}
      </div>

      {vendor.status !== "APPROVED" && (
        <div className="glass border border-yellow-900/40 rounded-xl p-5 mb-6 flex items-center gap-4">
          <Clock size={20} className="text-yellow-500 flex-shrink-0" />
          <div>
            <div className="text-[var(--text-primary)] font-bold text-sm">Account Pending Approval</div>
            <div className="text-[var(--text-muted)] text-xs mt-1">
              You can submit products once your vendor account is approved by our team.
            </div>
          </div>
        </div>
      )}

      {vendor.products.length === 0 ? (
        <div className="glass border border-[var(--border-color)] rounded-2xl p-16 text-center">
          <div className="w-16 h-16 bg-[var(--bg-card)] rounded-2xl flex items-center justify-center mx-auto mb-4">
            <Package size={28} className="text-[var(--text-muted)]" />
          </div>
          <h3 className="text-[var(--text-primary)] font-bold text-lg mb-2">No products submitted yet</h3>
          <p className="text-[var(--text-muted)] text-sm mb-6">
            Submit your products and we&apos;ll list them in our catalog after review.
          </p>
          {vendor.status === "APPROVED" && (
            <Link
              href="/vendor/products/new"
              className="inline-flex items-center gap-2 bg-amber-600 hover:bg-amber-700 text-white font-bold px-6 py-3 rounded-xl transition-colors text-sm uppercase tracking-wider"
            >
              <Plus size={16} />
              Submit First Product
            </Link>
          )}
        </div>
      ) : (
        <div className="glass border border-[var(--border-color)] rounded-2xl overflow-hidden">
          <div className="grid grid-cols-[1fr_auto_auto_auto_auto] gap-0 text-[10px] uppercase tracking-widest text-[var(--text-muted)] font-bold px-6 py-3 border-b border-[var(--border-color)]">
            <span>Product</span>
            <span className="text-right pr-6">Cost Price</span>
            <span className="text-right pr-6">Markup</span>
            <span className="text-right pr-6">Dealer Price</span>
            <span className="text-right">Status</span>
          </div>
          {vendor.products.map((product) => (
            <div
              key={product.id}
              className="grid grid-cols-[1fr_auto_auto_auto_auto] items-center px-6 py-4 border-b border-[var(--border-color)] last:border-0 hover:bg-[var(--bg-card-hover)] transition-colors"
            >
              <div>
                <div className="text-[var(--text-primary)] font-semibold text-sm">{product.name}</div>
                <div className="flex items-center gap-2 mt-1">
                  <span className="text-[var(--text-muted)] text-[10px] font-mono">{product.partNumber}</span>
                  <span className="text-amber-500/60 text-[10px]">·</span>
                  <span className="text-[var(--text-muted)] text-[10px]">{product.category.name}</span>
                  <span className="text-[var(--text-muted)] text-[10px]">· Added {formatDate(product.createdAt)}</span>
                </div>
              </div>
              <div className="text-right pr-6">
                <div className="text-[var(--text-secondary)] text-sm font-semibold">
                  {product.vendorCostPrice != null ? formatCurrency(product.vendorCostPrice) : "—"}
                </div>
              </div>
              <div className="text-right pr-6">
                <div className="text-amber-400 text-sm font-semibold">
                  {product.markupPercent != null ? `${product.markupPercent}%` : "—"}
                </div>
              </div>
              <div className="text-right pr-6">
                <div className="text-[var(--text-primary)] text-sm font-bold">{formatCurrency(product.price)}</div>
              </div>
              <div className="flex items-center justify-end gap-1.5">
                {statusIcon[String(product.isActive)]}
                <span className={`text-xs font-semibold ${product.isActive ? "text-green-400" : "text-yellow-400"}`}>
                  {product.isActive ? "Live" : "Pending"}
                </span>
              </div>
            </div>
          ))}
        </div>
      )}

      <div className="mt-6 glass border border-[var(--border-color)] rounded-xl p-4">
        <div className="text-[var(--text-muted)] text-xs uppercase tracking-widest font-bold mb-3">How it works</div>
        <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
          {[
            { step: "1", title: "You Submit", desc: "Provide product details and your cost price" },
            { step: "2", title: "We Review", desc: "Our team adds our markup and reviews the listing" },
            { step: "3", title: "Goes Live", desc: "Product appears in our catalog for dealers" },
          ].map((item) => (
            <div key={item.step} className="flex items-start gap-3">
              <span className="w-6 h-6 bg-amber-600/20 text-amber-400 rounded-full text-xs font-black flex items-center justify-center flex-shrink-0">
                {item.step}
              </span>
              <div>
                <div className="text-[var(--text-secondary)] text-sm font-semibold">{item.title}</div>
                <div className="text-[var(--text-muted)] text-xs">{item.desc}</div>
              </div>
            </div>
          ))}
        </div>
      </div>
    </div>
  );
}
