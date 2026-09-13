import { prisma } from "@/lib/prisma";
import Link from "next/link";
import { Plus, Truck, FileSpreadsheet, GitMerge, Search } from "lucide-react";
import { ProductsTable } from "@/components/admin/products-table";
import { buildSearchWhere } from "@/lib/product-search";

const SORT_OPTIONS = [
  { value: "newest",   label: "Newest First",    orderBy: { createdAt: "desc" as const } },
  { value: "part_asc", label: "Part No. A→Z",    orderBy: { partNumber: "asc"  as const } },
  { value: "part_desc",label: "Part No. Z→A",    orderBy: { partNumber: "desc" as const } },
  { value: "sku_asc",  label: "SKU A→Z",         orderBy: { sku: "asc"  as const } },
  { value: "sku_desc", label: "SKU Z→A",         orderBy: { sku: "desc" as const } },
];

export default async function AdminProductsPage(
  props: {
    searchParams: Promise<{ page?: string; category?: string; vendor?: string; search?: string; sort?: string }>;
  }
) {
  const searchParams = await props.searchParams;
  const page = parseInt(searchParams.page || "1");
  const pageSize = 20;
  const search = searchParams.search?.trim();
  const sortKey = searchParams.sort || "newest";
  const sortOption = SORT_OPTIONS.find(s => s.value === sortKey) ?? SORT_OPTIONS[0];

  const searchWhere = search ? await buildSearchWhere(search, false) : {};

  const where: Record<string, unknown> = { ...searchWhere };
  if (searchParams.category) where.categoryId = searchParams.category;
  if (searchParams.vendor === "pending") { where.vendorId = { not: null }; where.isActive = false; }
  else if (searchParams.vendor === "all") where.vendorId = { not: null };

  const [products, categories, total, pendingVendorCount] = await Promise.all([
    prisma.product.findMany({
      where,
      include: {
        category: true,
        productImages: { orderBy: [{ isPrimary: "desc" }, { sortOrder: "asc" }], take: 1 },
        vendor: { select: { companyName: true } },
      },
      orderBy: sortOption.orderBy,
      skip: (page - 1) * pageSize,
      take: pageSize,
    }),
    prisma.category.findMany({ orderBy: { sortOrder: "asc" } }),
    prisma.product.count({ where }),
    prisma.product.count({ where: { vendorId: { not: null }, isActive: false } }),
  ]);

  const totalPages = Math.ceil(total / pageSize);

  return (
    <div>
      <div className="mb-8 flex items-center justify-between flex-wrap gap-4">
        <div>
          <h1 className="text-3xl font-black text-[var(--text-primary)] tracking-tight">Products</h1>
          <p className="text-[var(--text-muted)] mt-1">{total} products{search && ` matching "${search}"`}</p>
        </div>
        <div className="flex items-center gap-3 flex-wrap">
          {pendingVendorCount > 0 && (
            <Link
              href="/admin/products?vendor=pending"
              className="flex items-center gap-2 glass border border-yellow-900/40 text-yellow-400 font-bold px-4 py-2.5 rounded-xl transition-colors text-sm hover:border-yellow-600/60"
            >
              <Truck size={14} />
              {pendingVendorCount} Vendor Pending
            </Link>
          )}
          <Link
            href="/admin/products/consolidate"
            className="flex items-center gap-2 glass border border-[var(--border-color)] text-[var(--text-secondary)] font-bold px-4 py-2.5 rounded-xl transition-colors text-sm hover:border-purple-600/50 hover:text-purple-400"
          >
            <GitMerge size={14} />
            Consolidate
          </Link>
          <Link
            href="/admin/products/import"
            className="flex items-center gap-2 glass border border-[var(--border-color)] text-[var(--text-secondary)] font-bold px-4 py-2.5 rounded-xl transition-colors text-sm hover:border-red-900/40"
          >
            <FileSpreadsheet size={14} />
            Bulk Import
          </Link>
          <Link
            href="/admin/products/new"
            className="flex items-center gap-2 bg-red-600 hover:bg-red-700 text-white font-bold px-4 py-2.5 rounded-xl transition-colors text-sm uppercase tracking-wider"
          >
            <Plus size={16} />
            Add Product
          </Link>
        </div>
      </div>

      {/* Search bar */}
      <form method="GET" action="/admin/products" className="mb-5">
        {searchParams.category && <input type="hidden" name="category" value={searchParams.category} />}
        {searchParams.vendor && <input type="hidden" name="vendor" value={searchParams.vendor} />}
        {sortKey !== "newest" && <input type="hidden" name="sort" value={sortKey} />}
        <div className="relative max-w-md">
          <Search size={14} className="absolute left-3.5 top-1/2 -translate-y-1/2 text-[var(--text-muted)]" />
          <input
            name="search"
            defaultValue={search}
            placeholder="Search by name, part number, SKU, brand, vehicle..."
            className="w-full bg-[var(--bg-input)] border border-[var(--border-color)] rounded-xl pl-10 pr-4 py-2.5 text-sm text-[var(--text-primary)] focus:outline-none focus:border-red-600 placeholder:text-[var(--text-muted)]"
            autoComplete="off"
          />
          {search && (
            <Link
              href="/admin/products"
              className="absolute right-3 top-1/2 -translate-y-1/2 text-[var(--text-muted)] hover:text-red-400 text-xs"
            >
              ✕
            </Link>
          )}
        </div>
      </form>

      {/* Vendor filter tabs */}
      <div className="flex gap-2 mb-4">
        <Link href={`/admin/products?${new URLSearchParams({ ...(search && { search }), ...(sortKey !== "newest" && { sort: sortKey }) }).toString()}`} className={`px-3 py-1.5 rounded-lg text-xs font-bold uppercase tracking-wider transition-colors ${!searchParams.vendor ? "bg-red-600 text-white" : "glass border border-[var(--border-color)] text-[var(--text-muted)]"}`}>All</Link>
        <Link href={`/admin/products?${new URLSearchParams({ vendor: "all", ...(search && { search }), ...(sortKey !== "newest" && { sort: sortKey }) }).toString()}`} className={`px-3 py-1.5 rounded-lg text-xs font-bold uppercase tracking-wider transition-colors ${searchParams.vendor === "all" ? "bg-amber-600 text-white" : "glass border border-[var(--border-color)] text-[var(--text-muted)]"}`}>Vendor Products</Link>
        <Link href={`/admin/products?${new URLSearchParams({ vendor: "pending", ...(search && { search }), ...(sortKey !== "newest" && { sort: sortKey }) }).toString()}`} className={`px-3 py-1.5 rounded-lg text-xs font-bold uppercase tracking-wider transition-colors ${searchParams.vendor === "pending" ? "bg-yellow-600 text-white" : "glass border border-[var(--border-color)] text-[var(--text-muted)]"}`}>
          Pending Review {pendingVendorCount > 0 && <span className="ml-1 bg-yellow-500 text-black rounded-full px-1.5 text-[9px]">{pendingVendorCount}</span>}
        </Link>
      </div>

      {/* Category filter */}
      <div className="flex flex-wrap gap-2 mb-4">
        <Link
          href={`/admin/products?${new URLSearchParams({ ...(searchParams.vendor && { vendor: searchParams.vendor }), ...(search && { search }), ...(sortKey !== "newest" && { sort: sortKey }) }).toString()}`}
          className={`px-3 py-2 rounded-xl text-xs font-semibold uppercase tracking-wider transition-colors ${!searchParams.category ? "bg-red-600 text-white" : "glass border border-[var(--border-color)] text-[var(--text-muted)] hover:border-red-600/50"}`}
        >
          All
        </Link>
        {categories.map((cat) => (
          <Link
            key={cat.id}
            href={`/admin/products?${new URLSearchParams({ category: cat.id, ...(searchParams.vendor && { vendor: searchParams.vendor }), ...(search && { search }), ...(sortKey !== "newest" && { sort: sortKey }) }).toString()}`}
            className={`px-3 py-2 rounded-xl text-xs font-semibold uppercase tracking-wider transition-colors ${searchParams.category === cat.id ? "bg-red-600 text-white" : "glass border border-[var(--border-color)] text-[var(--text-muted)] hover:border-red-600/50"}`}
          >
            {cat.name}
          </Link>
        ))}
      </div>

      {/* Sort selector */}
      <div className="flex items-center gap-2 mb-6">
        <span className="text-[var(--text-muted)] text-xs uppercase tracking-wider font-semibold">Sort:</span>
        {SORT_OPTIONS.map((opt) => (
          <Link
            key={opt.value}
            href={`/admin/products?${new URLSearchParams({ ...(searchParams.category && { category: searchParams.category }), ...(searchParams.vendor && { vendor: searchParams.vendor }), ...(search && { search }), ...(opt.value !== "newest" && { sort: opt.value }) }).toString()}`}
            className={`px-3 py-1.5 rounded-lg text-xs font-semibold transition-colors ${sortKey === opt.value ? "bg-zinc-700 text-white border border-zinc-500" : "glass border border-[var(--border-color)] text-[var(--text-muted)] hover:border-zinc-500"}`}
          >
            {opt.label}
          </Link>
        ))}
      </div>

      <ProductsTable products={products as any} search={search} />

      {totalPages > 1 && (
        <div className="flex items-center justify-center gap-2 mt-8">
          {page > 1 && (
            <Link
              href={`/admin/products?${new URLSearchParams({ page: String(page - 1), ...(searchParams.category && { category: searchParams.category }), ...(searchParams.vendor && { vendor: searchParams.vendor }), ...(search && { search }), ...(sortKey !== "newest" && { sort: sortKey }) }).toString()}`}
              className="w-10 h-10 flex items-center justify-center rounded-xl glass border border-[var(--border-color)] text-[var(--text-muted)] hover:border-red-600/50 hover:text-white transition-colors"
            >
              ‹
            </Link>
          )}
          {(() => {
            const delta = 3;
            const start = Math.max(1, Math.min(page - delta, totalPages - delta * 2));
            const end = Math.min(totalPages, start + delta * 2);
            return Array.from({ length: end - start + 1 }, (_, i) => start + i).map((p) => (
              <Link
                key={p}
                href={`/admin/products?${new URLSearchParams({ page: String(p), ...(searchParams.category && { category: searchParams.category }), ...(searchParams.vendor && { vendor: searchParams.vendor }), ...(search && { search }), ...(sortKey !== "newest" && { sort: sortKey }) }).toString()}`}
                className={`w-10 h-10 flex items-center justify-center rounded-xl text-sm font-bold transition-colors ${p === page ? "bg-red-600 text-white" : "glass border border-[var(--border-color)] text-[var(--text-muted)] hover:border-red-600/50 hover:text-white"}`}
              >
                {p}
              </Link>
            ));
          })()}
          {page < totalPages && (
            <Link
              href={`/admin/products?${new URLSearchParams({ page: String(page + 1), ...(searchParams.category && { category: searchParams.category }), ...(searchParams.vendor && { vendor: searchParams.vendor }), ...(search && { search }), ...(sortKey !== "newest" && { sort: sortKey }) }).toString()}`}
              className="w-10 h-10 flex items-center justify-center rounded-xl glass border border-[var(--border-color)] text-[var(--text-muted)] hover:border-red-600/50 hover:text-white transition-colors"
            >
              ›
            </Link>
          )}
        </div>
      )}
    </div>
  );
}
