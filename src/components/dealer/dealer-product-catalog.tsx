"use client";

import { useState } from "react";
import Link from "next/link";
import Image from "next/image";
import { useRouter } from "next/navigation";
import { Search, ShoppingCart, CheckCircle, Plus, Minus, ChevronRight } from "lucide-react";
import { Spinner } from "@/components/ui/spinner";
import { formatCurrency } from "@/lib/utils";
import { getStockStatus, stockStatusLabel } from "@/lib/stock-status";

interface ProductImage { id: string; imageUrl: string; isPrimary: boolean; sortOrder: number; }

interface Product {
  id: string;
  name: string;
  sku: string;
  partNumber: string;
  oemNumber?: string | null;
  price: number;
  mrp?: number | null;
  gstRate: number;
  moq: number;
  images: string[];
  productImages?: ProductImage[];
  stock: number;
  vendorId?: string | null;
  category: { name: string };
  _count?: { variants: number };
}

interface Props {
  products: Product[];
  categories: Array<{ id: string; name: string; slug: string }>;
  total: number;
  currentPage: number;
  pageSize: number;
  currentCategory?: string;
  currentSearch?: string;
}

export function DealerProductCatalog({
  products,
  categories,
  total,
  currentPage,
  pageSize,
  currentCategory,
  currentSearch,
}: Props) {
  const router = useRouter();
  const [search, setSearch] = useState(currentSearch || "");
  const [quantities, setQuantities] = useState<Record<string, number>>({});
  const [addingToCart, setAddingToCart] = useState<string | null>(null);
  const [addedIds, setAddedIds] = useState<string[]>([]);
  const [cartError, setCartError] = useState<string | null>(null);
  const totalPages = Math.ceil(total / pageSize);

  // Largest multiple of MOQ that still fits within available stock — 0 means
  // the dealer can't place a valid order at all (stock below one MOQ batch).
  const maxOrderQty = (product: Product) => Math.floor(product.stock / product.moq) * product.moq;
  const canOrder = (product: Product) => maxOrderQty(product) >= product.moq;
  const getQuantity = (product: Product) => {
    const max = maxOrderQty(product);
    return Math.min(quantities[product.id] || product.moq, max || product.moq);
  };

  const handleSearch = (e: React.FormEvent) => {
    e.preventDefault();
    const params = new URLSearchParams();
    if (search) params.set("search", search);
    if (currentCategory) params.set("category", currentCategory);
    router.push(`/dealer/products?${params.toString()}`);
  };

  const handleCategoryFilter = (slug: string | null) => {
    const params = new URLSearchParams();
    if (slug) params.set("category", slug);
    if (search) params.set("search", search);
    router.push(`/dealer/products?${params.toString()}`);
  };

  const handleAddToCart = async (product: Product) => {
    const qty = getQuantity(product);
    setAddingToCart(product.id);
    setCartError(null);
    try {
      const res = await fetch("/api/cart", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ productId: product.id, quantity: qty }),
      });
      if (res.ok) {
        setAddedIds((prev) => [...prev, product.id]);
        setTimeout(() => {
          setAddedIds((prev) => prev.filter((id) => id !== product.id));
        }, 2000);
      } else {
        const data = await res.json().catch(() => ({}));
        setCartError(data.error || "Failed to add to cart. Please try again.");
        setTimeout(() => setCartError(null), 4000);
      }
    } catch {
      setCartError("Network error. Please check your connection.");
      setTimeout(() => setCartError(null), 4000);
    }
    setAddingToCart(null);
  };

  return (
    <div className="max-w-[1600px] mx-auto">
      {/* Filters */}
      <div className="flex flex-col sm:flex-row gap-3 mb-5">
        <form onSubmit={handleSearch} className="flex-1 relative">
          <Search size={16} className="absolute left-4 top-1/2 -translate-y-1/2 text-[var(--text-muted)]" />
          <input
            type="text"
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            placeholder="Search products..."
            className="w-full themed-input border focus:border-red-600/60 rounded-sm pl-10 pr-4 py-2.5 text-sm outline-none transition-colors"
          />
        </form>
        <div className="flex flex-wrap gap-2">
          <button
            onClick={() => handleCategoryFilter(null)}
            className={`px-3 py-2 rounded-sm text-xs font-semibold uppercase tracking-wider transition-colors ${!currentCategory ? "bg-red-600 text-white" : "glass border border-[var(--border-color)] text-[var(--text-muted)] hover:border-red-600/50"}`}
          >
            All
          </button>
          {categories.map((cat) => (
            <button
              key={cat.id}
              onClick={() => handleCategoryFilter(cat.slug)}
              className={`px-3 py-2 rounded-sm text-xs font-semibold uppercase tracking-wider transition-colors ${currentCategory === cat.slug ? "bg-red-600 text-white" : "glass border border-[var(--border-color)] text-[var(--text-muted)] hover:border-red-600/50"}`}
            >
              {cat.name}
            </button>
          ))}
        </div>
      </div>

      {cartError && (
        <div className="mb-4 bg-red-900/20 border border-red-900/40 rounded-xl px-4 py-3 text-red-400 text-sm flex items-center gap-2">
          <svg className="w-4 h-4 flex-shrink-0" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 9v2m0 4h.01M21 12a9 9 0 11-18 0 9 9 0 0118 0z" /></svg>
          {cartError}
        </div>
      )}
      <p className="text-[var(--text-muted)] text-xs mb-3">Showing {products.length} of {total} products</p>

      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-3.5 sm:gap-4">
        {products.map((product) => {
          const hasVariants = (product._count?.variants ?? 0) > 0;
          const isInStock = canOrder(product);
          const stockLabel = product.stock < product.moq ? "Out of Stock" : stockStatusLabel(product.stock);
          const stockBadgeCls = !isInStock
            ? "bg-red-500/15 text-red-500"
            : getStockStatus(product.stock) === "low_stock"
            ? "bg-amber-500/15 text-amber-500"
            : "bg-green-500/15 text-green-600";
          const thumb =
            product.productImages && product.productImages.length > 0
              ? (product.productImages.find((i) => i.isPrimary) || product.productImages[0]).imageUrl
              : product.images[0];
          return (
          <div key={product.id} className="flex flex-col glass border border-[var(--border-color)] hover:border-red-900/30 rounded-sm overflow-hidden transition-all h-full">
            {/* Image */}
            <Link href={`/products/${product.id}`} className="block flex-shrink-0">
              <div className="relative aspect-[4/3] w-full bg-[var(--bg-secondary)] overflow-hidden">
                {thumb ? (
                  <Image src={thumb} alt={product.name} fill className="object-contain p-2 hover:scale-105 transition-transform" sizes="(max-width: 640px) 100vw, (max-width: 1024px) 50vw, 25vw" unoptimized />
                ) : (
                  <div className="w-full h-full flex items-center justify-center">
                    <div className="text-4xl text-red-500/20 font-black">◈</div>
                  </div>
                )}
                {hasVariants && (
                  <div className="absolute top-2 right-2 bg-red-600 text-white text-[9px] font-bold uppercase tracking-wider px-2 py-0.5 rounded-full">
                    {product._count!.variants} options
                  </div>
                )}
              </div>
            </Link>

            <div className="p-3.5 flex flex-col flex-1">
              <div className="text-[var(--text-muted)] text-[10px] font-mono mb-1 truncate">
                {product.partNumber}{product.oemNumber ? ` • OEM: ${product.oemNumber}` : ""}
              </div>
              <Link href={`/products/${product.id}`}>
                <h3 className="text-[var(--text-primary)] font-bold text-sm leading-snug hover:text-red-600 transition-colors line-clamp-2 mb-1.5 min-h-[2.5em]">
                  {product.name}
                </h3>
              </Link>
              <div className="text-[var(--text-muted)] text-[11px] mb-2.5">{product.category.name}</div>

              <div className="flex items-start justify-between gap-2 mb-3">
                <div className="min-w-0">
                  <div className="text-[var(--text-muted)] text-[9px] uppercase tracking-wider mb-0.5">Wholesale Price</div>
                  <div className="text-red-500 font-black text-base leading-tight">{formatCurrency(product.price)}</div>
                  {product.mrp && (
                    <div className="flex items-center gap-1.5 mt-0.5 flex-wrap">
                      <span className="text-green-600 text-[9px] font-bold bg-green-500/10 px-1.5 py-0.5 rounded-full">
                        70% OFF
                      </span>
                      <span className="text-[var(--text-muted)] text-[9px]">
                        MRP <span className="line-through">₹{product.mrp.toLocaleString("en-IN")}</span>
                      </span>
                    </div>
                  )}
                  <div className="text-[var(--text-muted)] text-[9px] mt-0.5">+ {product.gstRate}% GST • MOQ: {product.moq}</div>
                </div>
                {!hasVariants && (
                  <div className={`flex-shrink-0 text-[10px] font-semibold px-1.5 py-0.5 rounded-sm whitespace-nowrap ${stockBadgeCls}`}>
                    {stockLabel}
                  </div>
                )}
              </div>

              {/* Push controls to the bottom of the card so heights line up */}
              <div className="mt-auto">
                {/* Variant product: go to detail page to choose options */}
                {hasVariants ? (
                  <Link
                    href={`/products/${product.id}`}
                    className="w-full flex items-center justify-center gap-2 py-2 rounded-sm text-xs font-bold uppercase tracking-wider bg-red-600 hover:bg-red-700 text-white transition-colors"
                  >
                    Select Model &amp; Color
                    <ChevronRight size={13} />
                  </Link>
                ) : !isInStock ? (
                  /* Out of stock: disabled quantity + status button, no loud red */
                  <div className="flex items-center gap-2">
                    <div className="flex items-center border border-[var(--border-color)] rounded-sm overflow-hidden opacity-50">
                      <span className="px-2.5 py-2 text-[var(--text-muted)]"><Minus size={12} /></span>
                      <span className="px-2 text-[var(--text-muted)] text-sm font-bold min-w-[28px] text-center">0</span>
                      <span className="px-2.5 py-2 text-[var(--text-muted)]"><Plus size={12} /></span>
                    </div>
                    <button
                      disabled
                      className="flex-1 flex items-center justify-center py-2 rounded-sm text-[11px] font-bold uppercase tracking-wider bg-red-500/10 text-red-500/80 border border-red-500/20 cursor-not-allowed"
                    >
                      Out of Stock
                    </button>
                  </div>
                ) : (
                /* Simple product: add to cart directly */
                <div className="flex items-center gap-2">
                  <div className="flex items-center glass border border-[var(--border-color)] rounded-sm overflow-hidden">
                    <button
                      onClick={() => setQuantities((q) => ({ ...q, [product.id]: Math.max(product.moq, getQuantity(product) - product.moq) }))}
                      className="px-2.5 py-2 text-[var(--text-muted)] hover:text-[var(--text-primary)] hover:bg-[var(--bg-card-hover)] transition-colors"
                    >
                      <Minus size={12} />
                    </button>
                    <span className="px-2 text-[var(--text-primary)] text-sm font-bold min-w-[28px] text-center">{getQuantity(product)}</span>
                    <button
                      onClick={() => setQuantities((q) => ({ ...q, [product.id]: Math.min(getQuantity(product) + product.moq, maxOrderQty(product)) }))}
                      disabled={getQuantity(product) >= maxOrderQty(product)}
                      className="px-2.5 py-2 text-[var(--text-muted)] hover:text-[var(--text-primary)] hover:bg-[var(--bg-card-hover)] disabled:opacity-40 disabled:hover:bg-transparent transition-colors"
                    >
                      <Plus size={12} />
                    </button>
                  </div>
                  <button
                    onClick={() => handleAddToCart(product)}
                    disabled={addingToCart === product.id}
                    className={`flex-1 flex items-center justify-center gap-1.5 py-2 rounded-sm text-[11px] font-bold uppercase tracking-wider transition-all ${
                      addedIds.includes(product.id)
                        ? "bg-green-700 text-white"
                        : "bg-red-600 hover:bg-red-700 text-white disabled:opacity-50"
                    }`}
                  >
                    {addedIds.includes(product.id) ? (
                      <><CheckCircle size={12} /> Added</>
                    ) : addingToCart === product.id ? (
                      <><Spinner size={12} /> Adding...</>
                    ) : (
                      <><ShoppingCart size={12} /> Add</>
                    )}
                  </button>
                </div>
                )}
              </div>
            </div>
          </div>
          );
        })}
      </div>

      {totalPages > 1 && (
        <div className="flex items-center justify-center gap-2 mt-8">
          {Array.from({ length: totalPages }, (_, i) => i + 1).map((p) => (
            <Link
              key={p}
              href={`/dealer/products?page=${p}${currentCategory ? `&category=${currentCategory}` : ""}${currentSearch ? `&search=${currentSearch}` : ""}`}
              className={`w-10 h-10 flex items-center justify-center rounded-sm text-sm font-bold ${p === currentPage ? "bg-red-600 text-white" : "glass border border-[var(--border-color)] text-[var(--text-muted)] hover:border-red-600/50"}`}
            >
              {p}
            </Link>
          ))}
        </div>
      )}
    </div>
  );
}
