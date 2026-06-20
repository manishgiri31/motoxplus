"use client";

import { useState } from "react";
import Link from "next/link";
import Image from "next/image";
import { useRouter } from "next/navigation";
import { useSession } from "next-auth/react";
import { Search, Lock, Package, ChevronLeft, ChevronRight } from "lucide-react";

interface ProductImage { id: string; imageUrl: string; isPrimary: boolean; sortOrder: number; }

interface Product {
  id: string;
  name: string;
  sku: string;
  partNumber: string;
  description: string | null;
  images: string[];
  productImages?: ProductImage[];
  compatibility: string[];
  price: number;
  mrp?: number | null;
  moq: number;
  category: { name: string; slug: string };
}

interface Category {
  id: string;
  name: string;
  slug: string;
}

interface Props {
  products: Product[];
  categories: Category[];
  totalProducts: number;
  currentPage: number;
  pageSize: number;
  currentCategory?: string;
  currentSearch?: string;
}

export function ProductCatalog({
  products,
  categories,
  totalProducts,
  currentPage,
  pageSize,
  currentCategory,
  currentSearch,
}: Props) {
  const { data: session } = useSession();
  const router = useRouter();
  const [search, setSearch] = useState(currentSearch || "");
  const totalPages = Math.ceil(totalProducts / pageSize);
  const isDealer = session?.user?.role === "DEALER";

  const handleSearch = (e: React.FormEvent) => {
    e.preventDefault();
    const params = new URLSearchParams();
    if (search) params.set("search", search);
    if (currentCategory) params.set("category", currentCategory);
    router.push(`/products?${params.toString()}`);
  };

  const handleCategory = (slug: string | null) => {
    const params = new URLSearchParams();
    if (slug) params.set("category", slug);
    if (search) params.set("search", search);
    router.push(`/products?${params.toString()}`);
  };

  return (
    <div className="max-w-7xl mx-auto px-4 md:px-8 py-10">
      {/* Filters */}
      <div className="flex flex-col lg:flex-row gap-4 mb-8">
        {/* Search */}
        <form onSubmit={handleSearch} className="flex-1 relative">
          <Search size={15} className="absolute left-4 top-1/2 -translate-y-1/2 text-[var(--text-muted)]" />
          <input
            type="text"
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            placeholder="Search by name, part number, SKU..."
            className="w-full themed-input border rounded-xl pl-11 pr-4 py-3 text-sm"
          />
        </form>

        {/* Category pills */}
        <div className="flex flex-wrap gap-2">
          <button
            onClick={() => handleCategory(null)}
            className={`px-4 py-2 rounded-full text-xs font-bold uppercase tracking-wider transition-all duration-200 ${
              !currentCategory
                ? "bg-red-600 text-white shadow-[0_0_12px_rgba(220,38,38,0.3)]"
                : "glass border border-[var(--border-color)] text-[var(--text-muted)] hover:border-red-600/50 hover:text-[var(--text-primary)]"
            }`}
          >
            All
          </button>
          {categories.map((cat) => (
            <button
              key={cat.id}
              onClick={() => handleCategory(cat.slug)}
              className={`px-4 py-2 rounded-full text-xs font-bold uppercase tracking-wider transition-all duration-200 ${
                currentCategory === cat.slug
                  ? "bg-red-600 text-white shadow-[0_0_12px_rgba(220,38,38,0.3)]"
                  : "glass border border-[var(--border-color)] text-[var(--text-muted)] hover:border-red-600/50 hover:text-[var(--text-primary)]"
              }`}
            >
              {cat.name}
            </button>
          ))}
        </div>
      </div>

      {/* Results count */}
      <div className="flex items-center justify-between mb-6">
        <span className="text-[var(--text-muted)] text-sm">
          Showing <span className="text-[var(--text-primary)] font-semibold">{products.length}</span> of <span className="text-[var(--text-primary)] font-semibold">{totalProducts}</span> products
          {currentCategory && <span className="text-red-500"> in &quot;{currentCategory}&quot;</span>}
        </span>
        {!isDealer && (
          <div className="flex items-center gap-2 glass border border-red-900/25 rounded-full px-4 py-1.5">
            <Lock size={11} className="text-red-500" />
            <span className="text-red-400 text-xs font-semibold">
              Login as Dealer to View Pricing
            </span>
          </div>
        )}
      </div>

      {/* Product Grid */}
      {products.length === 0 ? (
        <div className="text-center py-20">
          <div className="w-16 h-16 bg-[var(--bg-card)] rounded-2xl flex items-center justify-center mx-auto mb-4">
            <Package size={28} className="text-[var(--text-muted)]" />
          </div>
          <h3 className="text-[var(--text-primary)] font-bold text-xl mb-2">No products found</h3>
          <p className="text-[var(--text-muted)]">Try adjusting your search or filter criteria.</p>
        </div>
      ) : (
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-4">
          {products.map((product) => {
            const thumb =
              product.productImages && product.productImages.length > 0
                ? (product.productImages.find((i) => i.isPrimary) || product.productImages[0]).imageUrl
                : product.images[0];
            return (
              <Link
                key={product.id}
                href={`/products/${product.id}`}
                className="group glass border border-[var(--border-color)] hover:border-red-900/40 rounded-2xl overflow-hidden transition-all duration-300 card-hover"
              >
                {/* Image */}
                <div className="relative h-48 bg-gradient-to-br from-zinc-900 to-black flex items-center justify-center overflow-hidden">
                  {thumb ? (
                    <Image
                      src={thumb}
                      alt={product.name}
                      fill
                      className="object-cover group-hover:scale-105 transition-transform duration-500"
                      sizes="300px"
                      unoptimized
                    />
                  ) : (
                    <div className="text-6xl text-red-900/20 font-black">◈</div>
                  )}
                  <div className="absolute inset-0 bg-gradient-to-t from-black/50 to-transparent opacity-0 group-hover:opacity-100 transition-opacity duration-300" />
                  <div className="absolute top-3 left-3">
                    <span className="bg-black/70 backdrop-blur-sm text-red-400 text-[10px] font-bold uppercase tracking-widest px-2.5 py-1 rounded-full">
                      {product.category.name}
                    </span>
                  </div>
                </div>

                {/* Content */}
                <div className="p-4">
                  <div className="text-[var(--text-muted)] text-[10px] uppercase tracking-widest mb-1 font-mono opacity-70">
                    {product.partNumber}
                  </div>
                  <h3 className="text-[var(--text-primary)] font-bold text-sm mb-2 line-clamp-2 group-hover:text-red-100 transition-colors">
                    {product.name}
                  </h3>
                  {product.compatibility.length > 0 && (
                    <div className="text-[var(--text-muted)] text-xs mb-3 opacity-70">
                      Fits: {product.compatibility.slice(0, 2).join(", ")}
                      {product.compatibility.length > 2 && " +more"}
                    </div>
                  )}
                  <div className="flex items-center justify-between pt-3 border-t border-[var(--border-color)]">
                    <div className="text-[var(--text-muted)] text-[10px] uppercase tracking-wide font-semibold">MOQ: {product.moq} pcs</div>
                    {isDealer ? (
                      <div className="text-right">
                        <div className="text-[10px] text-[var(--text-muted)] uppercase mb-0.5">Dealer Price</div>
                        <div className="text-red-400 font-black text-sm">
                          ₹{product.price.toLocaleString("en-IN")}
                        </div>
                      </div>
                    ) : product.mrp ? (
                      <div className="text-right">
                        <div className="text-[10px] text-[var(--text-muted)] uppercase mb-0.5">MRP</div>
                        <div className="text-[var(--text-primary)] font-black text-sm">
                          ₹{product.mrp.toLocaleString("en-IN")}
                        </div>
                      </div>
                    ) : (
                      <div className="flex items-center gap-1.5 glass border border-red-900/20 rounded-full px-2.5 py-1">
                        <Lock size={9} className="text-red-600" />
                        <span className="text-red-600 text-[9px] font-bold">Dealer Price</span>
                      </div>
                    )}
                  </div>
                </div>
              </Link>
            );
          })}
        </div>
      )}

      {/* Pagination */}
      {totalPages > 1 && (
        <div className="flex items-center justify-center gap-2 mt-12">
          {currentPage > 1 && (
            <Link
              href={`/products?page=${currentPage - 1}${currentCategory ? `&category=${currentCategory}` : ""}${currentSearch ? `&search=${currentSearch}` : ""}`}
              className="w-9 h-9 flex items-center justify-center rounded-xl glass border border-[var(--border-color)] text-[var(--text-muted)] hover:border-red-600/50 hover:text-[var(--text-primary)] transition-all"
            >
              <ChevronLeft size={16} />
            </Link>
          )}
          {Array.from({ length: totalPages }, (_, i) => i + 1).map((p) => (
            <Link
              key={p}
              href={`/products?page=${p}${currentCategory ? `&category=${currentCategory}` : ""}${currentSearch ? `&search=${currentSearch}` : ""}`}
              className={`w-9 h-9 flex items-center justify-center rounded-xl text-sm font-bold transition-all ${
                p === currentPage
                  ? "bg-red-600 text-white shadow-[0_0_12px_rgba(220,38,38,0.3)]"
                  : "glass border border-[var(--border-color)] text-[var(--text-muted)] hover:border-red-600/50 hover:text-[var(--text-primary)]"
              }`}
            >
              {p}
            </Link>
          ))}
          {currentPage < totalPages && (
            <Link
              href={`/products?page=${currentPage + 1}${currentCategory ? `&category=${currentCategory}` : ""}${currentSearch ? `&search=${currentSearch}` : ""}`}
              className="w-9 h-9 flex items-center justify-center rounded-xl glass border border-[var(--border-color)] text-[var(--text-muted)] hover:border-red-600/50 hover:text-[var(--text-primary)] transition-all"
            >
              <ChevronRight size={16} />
            </Link>
          )}
        </div>
      )}
    </div>
  );
}
