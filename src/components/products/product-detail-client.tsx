"use client";

import { useState } from "react";
import Image from "next/image";
import Link from "next/link";
import { useSession } from "next-auth/react";
import { useRouter } from "next/navigation";
import { ShoppingCart, Lock, Plus, Minus, CheckCircle, ChevronLeft, ChevronRight, Shield, Tag, PackageOpen } from "lucide-react";
import { formatCurrency } from "@/lib/utils";

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
  moq: number;
  gstRate: number;
  hsnCode?: string;
  brand?: string;
  oemNumber?: string | null;
  warranty?: string;
  countryOfOrigin?: string;
  packageWeight?: number | null;
  packageLength?: number | null;
  packageWidth?: number | null;
  packageHeight?: number | null;
  weight: number | null;
  category: { name: string; slug: string };
}

interface Props {
  product: Product;
  relatedProducts: Product[];
}

export function ProductDetailClient({ product, relatedProducts }: Props) {
  const { data: session } = useSession();
  const router = useRouter();

  // Build gallery from productImages (preferred) or legacy images array
  const gallery: string[] =
    product.productImages && product.productImages.length > 0
      ? product.productImages
          .sort((a, b) => (a.isPrimary ? -1 : b.isPrimary ? 1 : a.sortOrder - b.sortOrder))
          .map((img) => img.imageUrl)
      : product.images;

  const [selectedIdx, setSelectedIdx] = useState(0);
  const [quantity, setQuantity] = useState(product.moq);
  const [addedToCart, setAddedToCart] = useState(false);
  const [loading, setLoading] = useState(false);

  const isDealer = session?.user?.role === "DEALER";
  const priceWithGST = product.price * (1 + product.gstRate / 100);

  const prev = () => setSelectedIdx((i) => (i - 1 + gallery.length) % gallery.length);
  const next = () => setSelectedIdx((i) => (i + 1) % gallery.length);

  const handleAddToCart = async () => {
    if (!isDealer) { router.push("/login"); return; }
    setLoading(true);
    try {
      const res = await fetch("/api/cart", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ productId: product.id, quantity }),
      });
      if (res.ok) {
        setAddedToCart(true);
        setTimeout(() => setAddedToCart(false), 3000);
      }
    } catch { /* ignore */ } finally { setLoading(false); }
  };

  const getRelatedThumb = (p: Product) =>
    p.productImages && p.productImages.length > 0
      ? p.productImages.find((i) => i.isPrimary)?.imageUrl || p.productImages[0]?.imageUrl
      : p.images[0];

  return (
    <div className="max-w-7xl mx-auto px-4 md:px-8 py-12">
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-16 mb-16">

        {/* ── Gallery ── */}
        <div>
          <div className="relative aspect-square bg-gradient-to-br from-zinc-900 to-black rounded-sm overflow-hidden mb-4">
            {gallery[selectedIdx] ? (
              <Image
                src={gallery[selectedIdx]}
                alt={product.name}
                fill
                className="object-contain"
                sizes="(max-width: 1024px) 100vw, 50vw"
                unoptimized
              />
            ) : (
              <div className="w-full h-full flex items-center justify-center">
                <div className="text-8xl text-red-900/20 font-black">◈</div>
              </div>
            )}

            {gallery.length > 1 && (
              <>
                <button
                  onClick={prev}
                  className="absolute left-3 top-1/2 -translate-y-1/2 w-9 h-9 flex items-center justify-center rounded-sm glass border border-[var(--border-color)] text-[var(--text-primary)] hover:bg-[var(--bg-card-hover)] transition-colors"
                >
                  <ChevronLeft className="w-5 h-5" />
                </button>
                <button
                  onClick={next}
                  className="absolute right-3 top-1/2 -translate-y-1/2 w-9 h-9 flex items-center justify-center rounded-sm glass border border-[var(--border-color)] text-[var(--text-primary)] hover:bg-[var(--bg-card-hover)] transition-colors"
                >
                  <ChevronRight className="w-5 h-5" />
                </button>
                <div className="absolute bottom-3 left-1/2 -translate-x-1/2 flex gap-1.5">
                  {gallery.map((_, i) => (
                    <button
                      key={i}
                      onClick={() => setSelectedIdx(i)}
                      className={`w-1.5 h-1.5 rounded-full transition-colors ${i === selectedIdx ? "bg-red-500" : "bg-white/40"}`}
                    />
                  ))}
                </div>
              </>
            )}
          </div>

          {/* Thumbnail strip */}
          {gallery.length > 1 && (
            <div className="flex gap-2 overflow-x-auto pb-1">
              {gallery.map((img, i) => (
                <button
                  key={i}
                  onClick={() => setSelectedIdx(i)}
                  className={`relative w-16 h-16 flex-shrink-0 rounded-sm overflow-hidden border transition-colors ${
                    i === selectedIdx ? "border-red-600" : "border-[var(--border-color)] opacity-60 hover:opacity-100"
                  }`}
                >
                  <Image src={img} alt={`${product.name} ${i + 1}`} fill className="object-cover" sizes="64px" unoptimized />
                </button>
              ))}
            </div>
          )}
        </div>

        {/* ── Details ── */}
        <div>
          {/* Category + Brand */}
          <div className="flex items-center gap-2 mb-3 flex-wrap">
            <span className="glass border border-red-900/30 text-red-400 text-xs font-semibold uppercase tracking-wider px-3 py-1 rounded-sm">
              {product.category.name}
            </span>
            {product.brand && (
              <span className="glass border border-[var(--border-color)] text-[var(--text-secondary)] text-xs font-semibold uppercase tracking-wider px-3 py-1 rounded-sm">
                {product.brand}
              </span>
            )}
            {product.warranty && product.warranty !== "No Warranty" && (
              <span className="glass border border-green-900/40 text-green-400 text-xs font-semibold uppercase tracking-wider px-3 py-1 rounded-sm flex items-center gap-1">
                <Shield className="w-3 h-3" />
                {product.warranty}
              </span>
            )}
          </div>

          <h1 className="text-3xl md:text-4xl font-black text-[var(--text-primary)] tracking-tight mb-4">
            {product.name}
          </h1>

          {/* Part info grid */}
          <div className="grid grid-cols-2 gap-4 mb-6">
            {[
              { label: "Part Number", value: product.partNumber, mono: true },
              { label: "SKU", value: product.sku, mono: true },
              ...(product.oemNumber ? [{ label: "OEM Number", value: product.oemNumber, mono: true }] : []),
              { label: "MOQ", value: `${product.moq} pcs` },
              { label: "GST Rate", value: `${product.gstRate}%` },
              ...(product.hsnCode ? [{ label: "HSN Code", value: product.hsnCode, mono: true }] : []),
              ...(product.countryOfOrigin ? [{ label: "Country of Origin", value: product.countryOfOrigin }] : []),
            ].map((item) => (
              <div key={item.label}>
                <div className="text-[var(--text-muted)] text-xs uppercase tracking-widest mb-1">{item.label}</div>
                <div className={`text-[var(--text-primary)] text-sm font-semibold ${"mono" in item && item.mono ? "font-mono" : ""}`}>
                  {item.value}
                </div>
              </div>
            ))}
          </div>

          {/* Package dims */}
          {(product.packageWeight || product.packageLength) && (
            <div className="glass-dark border border-[var(--border-color)] rounded-sm p-4 mb-6 flex items-start gap-3">
              <PackageOpen className="w-4 h-4 text-[var(--text-muted)] mt-0.5 flex-shrink-0" />
              <div>
                <div className="text-[var(--text-muted)] text-xs uppercase tracking-widest mb-1">Package Dimensions</div>
                <div className="text-[var(--text-secondary)] text-sm">
                  {product.packageWeight && <span>{product.packageWeight} kg</span>}
                  {product.packageLength && (
                    <span className="ml-2 text-[var(--text-muted)]">
                      {product.packageLength} × {product.packageWidth} × {product.packageHeight} cm
                    </span>
                  )}
                </div>
              </div>
            </div>
          )}

          {/* Description */}
          {product.description && (
            <p className="text-[var(--text-muted)] text-sm leading-relaxed mb-6">{product.description}</p>
          )}

          {/* Compatibility */}
          {product.compatibility.length > 0 && (
            <div className="mb-6">
              <div className="text-[var(--text-muted)] text-xs uppercase tracking-widest mb-3">Compatible With</div>
              <div className="flex flex-wrap gap-2">
                {product.compatibility.map((model) => (
                  <span key={model} className="glass border border-[var(--border-color)] text-[var(--text-secondary)] text-xs px-3 py-1 rounded-sm">
                    {model}
                  </span>
                ))}
              </div>
            </div>
          )}

          {/* Pricing */}
          {isDealer ? (
            <div className="glass border border-[var(--border-color)] rounded-sm p-6 mb-6">
              <div className="flex items-baseline gap-4 mb-2">
                <div>
                  <div className="text-[var(--text-muted)] text-xs uppercase tracking-widest mb-1">Unit Price (excl. GST)</div>
                  <div className="text-3xl font-black text-[var(--text-primary)]">{formatCurrency(product.price)}</div>
                </div>
                <div>
                  <div className="text-[var(--text-muted)] text-xs uppercase tracking-widest mb-1">Incl. GST ({product.gstRate}%)</div>
                  <div className="text-xl font-bold text-red-400">{formatCurrency(priceWithGST)}</div>
                </div>
              </div>
              <div className="text-[var(--text-muted)] text-xs">
                Total for {quantity} pcs: {formatCurrency(product.price * quantity)}
              </div>
            </div>
          ) : (
            <div className="glass border border-red-900/30 rounded-sm p-6 mb-6 flex items-center gap-4">
              <Lock size={24} className="text-red-600 flex-shrink-0" />
              <div>
                <div className="text-[var(--text-primary)] font-bold mb-1">Dealer Pricing</div>
                <div className="text-[var(--text-muted)] text-sm">Login as an approved dealer to view pricing and add to cart.</div>
              </div>
            </div>
          )}

          {/* Add to Cart */}
          {isDealer && (
            <div className="flex items-center gap-4">
              <div className="flex items-center glass border border-[var(--border-color)] rounded-sm overflow-hidden">
                <button
                  onClick={() => setQuantity(Math.max(product.moq, quantity - product.moq))}
                  className="px-4 py-3 text-[var(--text-muted)] hover:text-[var(--text-primary)] hover:bg-[var(--bg-card-hover)] transition-colors"
                >
                  <Minus size={14} />
                </button>
                <span className="px-4 text-[var(--text-primary)] font-bold min-w-[60px] text-center">{quantity}</span>
                <button
                  onClick={() => setQuantity(quantity + product.moq)}
                  className="px-4 py-3 text-[var(--text-muted)] hover:text-[var(--text-primary)] hover:bg-[var(--bg-card-hover)] transition-colors"
                >
                  <Plus size={14} />
                </button>
              </div>
              <button
                onClick={handleAddToCart}
                disabled={loading || addedToCart}
                className={`flex-1 flex items-center justify-center gap-2 font-bold py-3 rounded-sm transition-all text-sm uppercase tracking-wider ${
                  addedToCart ? "bg-green-700 text-white" : "bg-red-600 hover:bg-red-700 text-white"
                }`}
              >
                {addedToCart ? (
                  <><CheckCircle size={16} /> Added to Cart</>
                ) : loading ? "Adding..." : (
                  <><ShoppingCart size={16} /> Add to Cart</>
                )}
              </button>
            </div>
          )}

          {!isDealer && (
            <Link
              href="/login"
              className="block w-full text-center bg-red-600 hover:bg-red-700 text-white font-bold py-3 rounded-sm transition-colors text-sm uppercase tracking-wider"
            >
              Login as Dealer to Order
            </Link>
          )}
        </div>
      </div>

      {/* Related Products */}
      {relatedProducts.length > 0 && (
        <div>
          <h2 className="text-2xl font-black text-[var(--text-primary)] mb-8">
            More from <span className="text-gradient-red">{product.category.name}</span>
          </h2>
          <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
            {relatedProducts.map((p) => {
              const thumb = getRelatedThumb(p);
              return (
                <Link
                  key={p.id}
                  href={`/products/${p.id}`}
                  className="group glass border border-[var(--border-color)] hover:border-red-900/40 rounded-sm overflow-hidden transition-all card-hover"
                >
                  <div className="relative h-36 bg-gradient-to-br from-zinc-900 to-black">
                    {thumb ? (
                      <Image src={thumb} alt={p.name} fill className="object-cover" sizes="300px" unoptimized />
                    ) : (
                      <div className="w-full h-full flex items-center justify-center">
                        <div className="text-4xl text-red-900/20 font-black">◈</div>
                      </div>
                    )}
                  </div>
                  <div className="p-4">
                    <div className="text-[var(--text-muted)] text-[10px] font-mono mb-1">{p.partNumber}</div>
                    <h4 className="text-[var(--text-primary)] text-sm font-bold line-clamp-2 group-hover:text-red-100 transition-colors">
                      {p.name}
                    </h4>
                  </div>
                </Link>
              );
            })}
          </div>
        </div>
      )}
    </div>
  );
}
