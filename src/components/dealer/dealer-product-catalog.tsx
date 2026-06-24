"use client";

import { useState } from "react";
import Link from "next/link";
import Image from "next/image";
import { useRouter } from "next/navigation";
import { Search, ShoppingCart, CheckCircle, Plus, Minus, ChevronRight } from "lucide-react";
import { Spinner } from "@/components/ui/spinner";
import { formatCurrency } from "@/lib/utils";

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

  const getQuantity = (product: Product) => quantities[product.id] || product.moq;

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
    <div>
      {/* Filters */}
      <div className="flex flex-col sm:flex-row gap-4 mb-6">
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
      <p className="text-[var(--text-muted)] text-sm mb-4">Showing {products.length} of {total} products</p>

      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4">
        {products.map((product) => {
          const hasVariants = (product._count?.variants ?? 0) > 0;
          const isInStock = hasVariants ? true : (product.vendorId ? true : product.stock > 0);
          const thumb =
            product.productImages && product.productImages.length > 0
              ? (product.productImages.find((i) => i.isPrimary) || product.productImages[0]).imageUrl
              : product.images[0];
          return (
          <div key={product.id} className="glass border border-[var(--border-color)] hover:border-red-900/30 rounded-sm overflow-hidden transition-all">
            {/* Image */}
            <Link href={`/products/${product.id}`}>
              <div className="relative h-36 bg-[var(--bg-secondary)] overflow-hidden">
                {thumb ? (
                  <Image src={thumb} alt={product.name} fill className="object-cover hover:scale-105 transition-transform" sizes="300px" unoptimized />
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

            <div className="p-4">
              <div className="text-[var(--text-muted)] text-[10px] font-mono mb-1">
                {product.partNumber}{product.oemNumber ? ` • OEM: ${product.oemNumber}` : ""}
              </div>
              <Link href={`/products/${product.id}`}>
                <h3 className="text-[var(--text-primary)] font-bold text-sm hover:text-red-600 transition-colors line-clamp-2 mb-2">
                  {product.name}
                </h3>
              </Link>
              <div className="text-[var(--text-muted)] text-xs mb-3">{product.category.name}</div>

              <div className="flex items-center justify-between mb-3">
                <div>
                  <div className="text-red-500 font-black text-lg">{formatCurrency(product.price * (1 + product.gstRate / 100))}</div>
                  <div className="text-[var(--text-muted)] text-[10px]">Base {formatCurrency(product.price)} + {product.gstRate}% GST • MOQ: {product.moq}</div>
                  {product.mrp && (
                    <div className="text-[var(--text-muted)] text-[10px] mt-0.5">
                      MRP <span className="line-through">₹{product.mrp.toLocaleString("en-IN")}</span>
                      {" "}
                      <span className="text-green-600 font-semibold">
                        Save {Math.round(((product.mrp - product.price) / product.mrp) * 100)}%
                      </span>
                    </div>
                  )}
                </div>
                {!hasVariants && (
                  <div className={`text-xs font-semibold px-2 py-0.5 rounded-sm ${isInStock ? "bg-green-500/15 text-green-600" : "bg-red-500/15 text-red-500"}`}>
                    {isInStock ? "In Stock" : "Out of Stock"}
                  </div>
                )}
              </div>

              {/* Variant product: go to detail page to choose options */}
              {hasVariants ? (
                <Link
                  href={`/products/${product.id}`}
                  className="w-full flex items-center justify-center gap-2 py-2.5 rounded-sm text-xs font-bold uppercase tracking-wider bg-red-600 hover:bg-red-700 text-white transition-colors"
                >
                  Select Model &amp; Color
                  <ChevronRight size={13} />
                </Link>
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
                  <span className="px-2 text-[var(--text-primary)] text-sm font-bold min-w-[32px] text-center">{getQuantity(product)}</span>
                  <button
                    onClick={() => setQuantities((q) => ({ ...q, [product.id]: getQuantity(product) + product.moq }))}
                    className="px-2.5 py-2 text-[var(--text-muted)] hover:text-[var(--text-primary)] hover:bg-[var(--bg-card-hover)] transition-colors"
                  >
                    <Plus size={12} />
                  </button>
                </div>
                <button
                  onClick={() => handleAddToCart(product)}
                  disabled={addingToCart === product.id || !isInStock}
                  className={`flex-1 flex items-center justify-center gap-1.5 py-2 rounded-sm text-xs font-bold uppercase tracking-wider transition-all ${
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
