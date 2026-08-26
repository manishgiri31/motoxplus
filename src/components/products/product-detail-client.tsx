"use client";

import { useState, useEffect, useRef } from "react";
import Image from "next/image";
import Link from "next/link";
import { useSession } from "next-auth/react";
import { useRouter } from "next/navigation";
import {
  ShoppingCart, Lock, Plus, Minus, CheckCircle, ChevronLeft, ChevronRight,
  Shield, Tag, PackageOpen, AlertTriangle,
} from "lucide-react";
import { formatCurrency } from "@/lib/utils";
import { getStockStatus, stockStatusLabel } from "@/lib/stock-status";

interface ProductImage { id: string; imageUrl: string; isPrimary: boolean; sortOrder: number; }
interface VariantImage { id: string; imageUrl: string; isPrimary: boolean; sortOrder: number; }

interface ProductVariant {
  id: string;
  label: string;
  sku: string | null;
  partNumber: string | null;
  color: string | null;
  vehicleModel: string | null;
  finish: string | null;
  size: string | null;
  extra: string | null;
  price: number;
  mrp: number | null;
  stock: number;
  moq: number | null;
  isActive: boolean;
  imageUrl: string | null;
  images?: VariantImage[];
}

interface Product {
  id: string;
  slug: string;
  name: string;
  sku: string;
  partNumber: string;
  description: string | null;
  images: string[];
  productImages?: ProductImage[];
  variants?: ProductVariant[];
  compatibility: string[];
  price: number;
  mrp?: number | null;
  moq: number;
  stock: number;
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

interface VehicleContext { slug: string; name: string; }
interface Props { product: Product; relatedProducts: Product[]; vehicleContext?: VehicleContext | null; }

// Attribute dimensions for Amazon-style selection
const DIMS = ["color", "vehicleModel", "finish", "size", "extra"] as const;
type Dim = (typeof DIMS)[number];
const DIM_LABELS: Record<Dim, string> = {
  color: "Color",
  vehicleModel: "Vehicle Model",
  finish: "Finish",
  size: "Size",
  extra: "Color / Type",
};

function isCssColor(str: string): boolean {
  const s = new Option().style;
  s.color = str;
  return s.color !== "";
}

function getModelBadge(model: string): { label: string; cls: string } | null {
  if (/\bN\/M\b/.test(model)) return { label: "NEW", cls: "bg-[var(--sig-ok-bg)] text-[var(--sig-ok-fg)] border border-[var(--sig-ok-bd)]" };
  if (/\bO\/M\b/.test(model)) return { label: "OLD", cls: "bg-[var(--sig-warn-bg)] text-[var(--sig-warn-fg)] border border-[var(--sig-warn-bd)]" };
  return null;
}

// Maps an `extra` / `color` value to a CSS background color for the image placeholder
const COLOR_MAP: Record<string, string> = {
  BLACK: "#1c1c1e", RED: "#b91c1c", SILVER: "#94a3b8", BLUE: "#2563eb",
  GREEN: "#16a34a", GREY: "#71717a", GRAY: "#71717a", PURPLE: "#7c3aed",
  ORANGE: "#ea580c", YELLOW: "#ca8a04", WHITE: "#e2e8f0", MAROON: "#7f1d1d",
  WINE: "#881337", GOLD: "#b45309", "M.BLUE": "#3b82f6", "T.BLUE": "#0ea5e9",
  "SKY BLUE": "#0ea5e9", "SKY BLACK": "#1c2526", TURQUOISE: "#0d9488",
  "SPORTS RED": "#991b1b", "SPORT RED": "#991b1b", "WIN RED": "#dc2626",
  "WINE RED": "#9f1239", "WINE BLACK": "#1c0a0e", "S.RED": "#b91c1c",
  "W.BLUE": "#1d4ed8", "W.RED": "#b91c1c", "METALLIC GREY": "#64748b",
  "SPRING GREEN": "#4ade80", "GENY GREY": "#6b7280", "MONSOON GREY": "#78716c",
};

function getExtraColor(val: string | null | undefined): string | null {
  if (!val) return null;
  const upper = val.toUpperCase();
  // Try longest match first
  for (const [key, hex] of Object.entries(COLOR_MAP).sort((a, b) => b[0].length - a[0].length)) {
    if (upper.startsWith(key)) return hex;
  }
  return null;
}

export function ProductDetailClient({ product, relatedProducts, vehicleContext }: Props) {
  const { data: session } = useSession();
  const router = useRouter();
  const modelDropdownRef = useRef<HTMLDivElement>(null);
  const [modelDropdownOpen, setModelDropdownOpen] = useState(false);

  const allVariants: ProductVariant[] = product.variants ?? [];
  const activeVariants = allVariants.filter((v) => v.isActive);
  const hasVariants = activeVariants.length > 0;

  // Detect which dimensions are used
  const activeDims = DIMS.filter((d) =>
    activeVariants.some((v) => v[d as keyof ProductVariant])
  );

  // Collect unique values per dimension
  const dimOptions: Partial<Record<Dim, string[]>> = {};
  for (const dim of activeDims) {
    const vals = Array.from(
      new Set(activeVariants.filter((v) => v[dim]).map((v) => v[dim] as string))
    );
    if (vals.length) dimOptions[dim] = vals;
  }

  // Amazon-style attribute selection state
  const [selectedAttrs, setSelectedAttrs] = useState<Partial<Record<Dim, string>>>(() => {
    // Pre-select first variant's values
    if (activeVariants.length > 0) {
      const first = activeVariants[0];
      const init: Partial<Record<Dim, string>> = {};
      for (const d of activeDims) {
        if (first[d as keyof ProductVariant]) init[d] = first[d as keyof ProductVariant] as string;
      }
      return init;
    }
    return {};
  });

  // Resolve which variant matches the selected combination
  const resolvedVariant: ProductVariant | null = (() => {
    if (!hasVariants) return null;
    if (activeDims.length === 0) return null;
    return (
      activeVariants.find((v) =>
        activeDims.every((d) => !selectedAttrs[d] || v[d as keyof ProductVariant] === selectedAttrs[d])
      ) ?? null
    );
  })();

  const activePrice = resolvedVariant ? resolvedVariant.price : product.price;
  const activeMrp = resolvedVariant ? (resolvedVariant.mrp ?? product.mrp) : product.mrp;
  const activeMoq = resolvedVariant?.moq ?? product.moq;
  const activeSku = resolvedVariant?.sku ?? product.sku;
  const activePartNumber = resolvedVariant?.partNumber ?? product.partNumber;
  const activeStock = hasVariants ? (resolvedVariant?.stock ?? 0) : product.stock;
  const priceWithGST = activePrice * (1 + product.gstRate / 100);
  const outOfStock = hasVariants ? !!resolvedVariant && resolvedVariant.stock <= 0 : product.stock <= 0;
  // Largest MOQ-multiple that still fits within available stock — 0 means no
  // valid order can be placed even though some stock may remain.
  const maxOrderQty = Math.floor(activeStock / activeMoq) * activeMoq;

  // Check if a value is available given current other-dimension selections
  const isValueAvailable = (dim: Dim, val: string): boolean => {
    // Vehicle model is always selectable — choosing it resets the colour automatically
    if (dim === "vehicleModel") return activeVariants.some((v) => v.vehicleModel === val);
    const testAttrs = { ...selectedAttrs, [dim]: val };
    return activeVariants.some((v) =>
      activeDims.every((d) => !testAttrs[d] || v[d as keyof ProductVariant] === testAttrs[d])
    );
  };

  // Gallery: use variant images → variant.imageUrl → product images → legacy
  const baseGallery: string[] =
    product.productImages && product.productImages.length > 0
      ? product.productImages
          .sort((a, b) => (a.isPrimary ? -1 : b.isPrimary ? 1 : a.sortOrder - b.sortOrder))
          .map((img) => img.imageUrl)
      : product.images;

  const variantGallery: string[] = (() => {
    if (!resolvedVariant) return [];
    if (resolvedVariant.images && resolvedVariant.images.length > 0) {
      return resolvedVariant.images
        .sort((a, b) => (a.isPrimary ? -1 : b.isPrimary ? 1 : a.sortOrder - b.sortOrder))
        .map((i) => i.imageUrl);
    }
    if (resolvedVariant.imageUrl) return [resolvedVariant.imageUrl];
    return [];
  })();

  const gallery = variantGallery.length > 0
    ? [...variantGallery, ...baseGallery.filter((u) => !variantGallery.includes(u))]
    : baseGallery;

  // Color to show in image area when no photo is available
  const activeColorBg: string | null =
    getExtraColor(resolvedVariant?.extra) ??
    (resolvedVariant?.color && isCssColor(resolvedVariant.color) ? resolvedVariant.color : null);

  const [selectedIdx, setSelectedIdx] = useState(0);
  const [quantity, setQuantity] = useState(activeMoq);
  const [addedToCart, setAddedToCart] = useState(false);
  const [loading, setLoading] = useState(false);

  // Reset gallery index when variant changes
  useEffect(() => { setSelectedIdx(0); }, [resolvedVariant?.id]);
  useEffect(() => {
    if (!modelDropdownOpen) return;
    const handler = (e: MouseEvent) => {
      if (modelDropdownRef.current && !modelDropdownRef.current.contains(e.target as Node))
        setModelDropdownOpen(false);
    };
    document.addEventListener("mousedown", handler);
    return () => document.removeEventListener("mousedown", handler);
  }, [modelDropdownOpen]);
  // Clamp quantity to new MOQ, then to whatever stock is actually available
  useEffect(() => {
    setQuantity((q) => {
      const snapped = Math.max(activeMoq, Math.round(q / activeMoq) * activeMoq || activeMoq);
      return maxOrderQty > 0 ? Math.min(snapped, maxOrderQty) : snapped;
    });
  }, [activeMoq, maxOrderQty]);

  const isDealer = session?.user?.role === "DEALER";

  const selectAttr = (dim: Dim, val: string) => {
    setSelectedAttrs((prev) => {
      const updated = { ...prev, [dim]: val };
      const dimIndex = activeDims.indexOf(dim);
      // For each downstream dim, keep value if still valid, else auto-pick first available
      for (let i = dimIndex + 1; i < activeDims.length; i++) {
        const downDim = activeDims[i];
        const downVal = updated[downDim];
        const stillValid = downVal && activeVariants.some((v) =>
          activeDims.slice(0, i + 1).every((d) => !updated[d] || v[d as keyof ProductVariant] === updated[d])
        );
        if (!stillValid) {
          // Auto-select the first available value for this downstream dim
          const firstAvailable = activeVariants.find((v) =>
            activeDims.slice(0, i).every((d) => !updated[d] || v[d as keyof ProductVariant] === updated[d]) &&
            v[downDim as keyof ProductVariant]
          )?.[downDim as keyof ProductVariant] as string | undefined;
          if (firstAvailable) updated[downDim] = firstAvailable;
          else delete updated[downDim];
        }
      }
      return updated;
    });
    setAddedToCart(false);
  };

  const prev = () => setSelectedIdx((i) => (i - 1 + gallery.length) % gallery.length);
  const next = () => setSelectedIdx((i) => (i + 1) % gallery.length);

  const handleAddToCart = async () => {
    if (!isDealer) { router.push("/login"); return; }
    if (hasVariants && !resolvedVariant) return;
    setLoading(true);
    try {
      const res = await fetch("/api/cart", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          productId: product.id,
          quantity,
          variantId: resolvedVariant?.id ?? null,
        }),
      });
      if (res.ok) {
        router.push("/dealer/cart");
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
          <div
            className="relative aspect-square rounded-sm overflow-hidden mb-4 border border-[var(--line)] transition-[background-color] duration-500"
            style={{ background: !gallery[selectedIdx] && activeColorBg ? activeColorBg : "var(--card)" }}
          >
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
              <div className="w-full h-full flex flex-col items-center justify-center gap-3">
                {activeColorBg ? (
                  <>
                    <div
                      className="w-24 h-24 rounded-full border-4 border-white/25 shadow-2xl"
                      style={{ background: activeColorBg, filter: "brightness(1.2) saturate(1.3)" }}
                    />
                    <span className="text-white/70 text-xs font-bold uppercase tracking-widest drop-shadow">
                      {resolvedVariant?.extra}
                    </span>
                  </>
                ) : (
                  <div className="text-8xl text-[var(--muted)] opacity-10 font-black select-none">◈</div>
                )}
              </div>
            )}

            {gallery.length > 1 && (
              <>
                <button
                  onClick={prev}
                  className="absolute left-3 top-1/2 -translate-y-1/2 w-9 h-9 flex items-center justify-center rounded-sm bg-[var(--card)] border border-[var(--line)] text-[var(--ink)] hover:border-[var(--red)]/40 transition-colors"
                >
                  <ChevronLeft className="w-5 h-5" />
                </button>
                <button
                  onClick={next}
                  className="absolute right-3 top-1/2 -translate-y-1/2 w-9 h-9 flex items-center justify-center rounded-sm bg-[var(--card)] border border-[var(--line)] text-[var(--ink)] hover:border-[var(--red)]/40 transition-colors"
                >
                  <ChevronRight className="w-5 h-5" />
                </button>
                <div className="absolute bottom-3 left-1/2 -translate-x-1/2 flex gap-1.5">
                  {gallery.map((_, i) => (
                    <button
                      key={i}
                      onClick={() => setSelectedIdx(i)}
                      className={`w-1.5 h-1.5 rounded-full transition-colors ${i === selectedIdx ? "bg-[var(--red)]" : "bg-white/40"}`}
                    />
                  ))}
                </div>
              </>
            )}
          </div>

          {gallery.length > 1 && (
            <div className="flex gap-2 overflow-x-auto pb-1">
              {gallery.map((img, i) => (
                <button
                  key={i}
                  onClick={() => setSelectedIdx(i)}
                  className={`relative w-16 h-16 flex-shrink-0 rounded-sm overflow-hidden border transition-colors ${
                    i === selectedIdx ? "border-[var(--red)]" : "border-[var(--line)] opacity-60 hover:opacity-100"
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
          {/* Category + Brand + Warranty badges */}
          <div className="flex items-center gap-2 mb-3 flex-wrap">
            {vehicleContext && (
              <Link
                href={`/products?vehicle=${vehicleContext.slug}`}
                className="border border-[var(--sig-ok-bd)] text-[var(--sig-ok-fg)] text-xs font-semibold uppercase tracking-wider px-3 py-1 hover:bg-[var(--sig-ok-bg)] transition-colors flex items-center gap-1.5"
              >
                <CheckCircle className="w-3 h-3" />
                Fits {vehicleContext.name}
              </Link>
            )}
            <span className="border border-[var(--red)]/30 text-[var(--red)] text-xs font-semibold uppercase tracking-wider px-3 py-1">
              {product.category.name}
            </span>
            {product.brand && (
              <span className="border border-[var(--line)] text-[var(--muted)] text-xs font-semibold uppercase tracking-wider px-3 py-1">
                {product.brand}
              </span>
            )}
            {product.warranty && product.warranty !== "No Warranty" && (
              <span className="border border-[var(--sig-ok-bd)] text-[var(--sig-ok-fg)] text-xs font-semibold uppercase tracking-wider px-3 py-1 flex items-center gap-1">
                <Shield className="w-3 h-3" />
                {product.warranty}
              </span>
            )}
          </div>

          <h1 className="font-display text-3xl md:text-4xl font-bold text-[var(--ink)] tracking-tight mb-4">
            {product.name}
            {resolvedVariant && (
              <span className="block text-lg font-semibold text-[var(--red)] mt-1">{resolvedVariant.label}</span>
            )}
          </h1>

          {/* Part info grid — updates with selected variant */}
          <div className="grid grid-cols-2 gap-4 mb-6">
            {[
              { label: "Part Number", value: activePartNumber, mono: true },
              { label: "SKU", value: activeSku, mono: true },
              ...(product.oemNumber ? [{ label: "OEM Number", value: product.oemNumber, mono: true }] : []),
              { label: "MOQ", value: `${activeMoq} pcs` },
              ...(hasVariants && resolvedVariant ? [{ label: "Stock", value: `${activeStock} pcs` }] : []),
              { label: "GST Rate", value: `${product.gstRate}%` },
              ...(product.hsnCode ? [{ label: "HSN Code", value: product.hsnCode, mono: true }] : []),
              ...(product.countryOfOrigin ? [{ label: "Country of Origin", value: product.countryOfOrigin }] : []),
            ].map((item) => (
              <div key={item.label}>
                <div className="text-[var(--muted)] text-xs uppercase tracking-widest mb-1">{item.label}</div>
                <div className={`tnum text-[var(--ink)] text-sm font-semibold ${"mono" in item && item.mono ? "font-mono" : ""}`}>
                  {item.value}
                </div>
              </div>
            ))}
          </div>

          {/* Package dims */}
          {(product.packageWeight || product.packageLength) && (
            <div className="bg-[var(--card)] border border-[var(--line)] rounded-sm p-4 mb-6 flex items-start gap-3">
              <PackageOpen className="w-4 h-4 text-[var(--muted)] mt-0.5 flex-shrink-0" />
              <div>
                <div className="text-[var(--muted)] text-xs uppercase tracking-widest mb-1">Package Dimensions</div>
                <div className="text-[var(--ink)]/80 text-sm">
                  {product.packageWeight && <span>{product.packageWeight} kg</span>}
                  {product.packageLength && (
                    <span className="ml-2 text-[var(--muted)]">
                      {product.packageLength} × {product.packageWidth} × {product.packageHeight} cm
                    </span>
                  )}
                </div>
              </div>
            </div>
          )}

          {product.description && (
            <p className="text-[var(--muted)] text-sm leading-relaxed mb-6">{product.description}</p>
          )}

          {product.compatibility.length > 0 && (
            <div className="mb-6">
              <div className="text-[var(--muted)] text-xs uppercase tracking-widest mb-3">Compatible With</div>
              <div className="flex flex-wrap gap-2">
                {product.compatibility.map((model) => (
                  <span key={model} className="border border-[var(--line)] text-[var(--ink)]/80 text-xs px-3 py-1">
                    {model}
                  </span>
                ))}
              </div>
            </div>
          )}

          {/* ── Amazon-style Variant Selector ── */}
          {hasVariants && activeDims.length > 0 && (
            <div className="mb-6 space-y-4">
              {activeDims.map((dim) => {
                // For secondary dims (not the first), filter options based on other-dim selections
                const otherDimAttrs = Object.fromEntries(
                  activeDims.filter((d) => d !== dim).map((d) => [d, selectedAttrs[d]])
                );
                const hasOtherSelections = Object.values(otherDimAttrs).some(Boolean);
                const options = hasOtherSelections
                  ? Array.from(
                      new Set(
                        activeVariants
                          .filter(
                            (v) =>
                              v[dim] &&
                              activeDims
                                .filter((d) => d !== dim)
                                .every(
                                  (d) => !otherDimAttrs[d] || v[d as keyof ProductVariant] === otherDimAttrs[d]
                                )
                          )
                          .map((v) => v[dim] as string)
                      )
                    )
                  : (dimOptions[dim] ?? []);
                const selectedVal = selectedAttrs[dim];
                // Use custom dropdown for vehicleModel (needs NEW/OLD badges); native select for other large sets
                const isModelDim = dim === "vehicleModel";
                const useDropdown = options.length > 8 || isModelDim;
                return (
                  <div key={dim}>
                    <div className="flex items-center gap-2 mb-2">
                      <span className="text-[var(--muted)] text-xs uppercase tracking-widest">{DIM_LABELS[dim]}</span>
                      {selectedVal && !useDropdown && (
                        <span className="text-[var(--ink)] text-xs font-semibold">— {selectedVal}</span>
                      )}
                    </div>
                    {isModelDim ? (
                      /* Custom dropdown for Vehicle Model — supports NEW/OLD badges */
                      <div ref={modelDropdownRef} className="relative">
                        <button
                          type="button"
                          onClick={() => setModelDropdownOpen((o) => !o)}
                          className="w-full bg-[var(--card)] border border-[var(--line)] rounded-sm px-4 py-3 text-sm text-left flex items-center justify-between gap-2 hover:border-[var(--red)]/50 transition-colors focus:outline-none focus:border-[var(--red)]"
                        >
                          <span className="flex items-center gap-2 min-w-0">
                            {selectedVal ? (
                              <>
                                <span className="text-[var(--ink)] truncate">{selectedVal}</span>
                                {getModelBadge(selectedVal) && (
                                  <span className={`text-[10px] font-bold px-1.5 py-0.5 rounded-full flex-shrink-0 ${getModelBadge(selectedVal)!.cls}`}>
                                    {getModelBadge(selectedVal)!.label}
                                  </span>
                                )}
                              </>
                            ) : (
                              <span className="text-[var(--muted)]">Select Vehicle Model...</span>
                            )}
                          </span>
                          <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" className={`text-[var(--muted)] flex-shrink-0 transition-transform ${modelDropdownOpen ? "rotate-180" : ""}`}>
                            <polyline points="6 9 12 15 18 9" />
                          </svg>
                        </button>
                        {modelDropdownOpen && (
                          <div className="absolute z-50 top-full mt-1 w-full bg-[var(--card)] border border-[var(--line)] rounded-sm shadow-[var(--elev-3)] overflow-hidden">
                            <div className="max-h-64 overflow-y-auto">
                              {/* Show ALL vehicle models as selectable — picking one resets the color */}
                              {(dimOptions["vehicleModel"] ?? options).map((val) => {
                                const badge = getModelBadge(val);
                                const isSelected = selectedVal === val;
                                return (
                                  <button
                                    key={val}
                                    type="button"
                                    onClick={() => { selectAttr(dim, val); setModelDropdownOpen(false); }}
                                    className={`w-full text-left px-4 py-2.5 text-sm flex items-center justify-between gap-2 transition-colors ${
                                      isSelected
                                        ? "bg-[var(--red-soft)] text-[var(--red)]"
                                        : "text-[var(--ink)]/80 hover:bg-[var(--paper)]"
                                    }`}
                                  >
                                    <span className="truncate">{val}</span>
                                    {badge && (
                                      <span className={`text-[10px] font-bold px-1.5 py-0.5 rounded-full flex-shrink-0 ${badge.cls}`}>
                                        {badge.label}
                                      </span>
                                    )}
                                  </button>
                                );
                              })}
                            </div>
                          </div>
                        )}
                      </div>
                    ) : useDropdown ? (
                      <select
                        value={selectedVal ?? ""}
                        onChange={(e) => e.target.value && selectAttr(dim, e.target.value)}
                        className="w-full themed-select rounded-sm px-4 py-3 text-sm appearance-none cursor-pointer"
                        style={{ backgroundImage: "url(\"data:image/svg+xml,%3Csvg xmlns='http://www.w3.org/2000/svg' width='12' height='12' viewBox='0 0 24 24' fill='none' stroke='%23999' stroke-width='2'%3E%3Cpolyline points='6 9 12 15 18 9'%3E%3C/polyline%3E%3C/svg%3E\")", backgroundRepeat: "no-repeat", backgroundPosition: "right 1rem center" }}
                      >
                        <option value="">Select {DIM_LABELS[dim]}...</option>
                        {options.map((val) => {
                          const available = isValueAvailable(dim, val);
                          return (
                            <option key={val} value={val} disabled={!available}>
                              {val}{!available ? " (unavailable)" : ""}
                            </option>
                          );
                        })}
                      </select>
                    ) : (
                      <div className="flex flex-wrap gap-2">
                        {options.map((val) => {
                          const isSelected = selectedVal === val;
                          const available = isValueAvailable(dim, val);
                          const isColor = dim === "color" && isCssColor(val);
                          return (
                            <button
                              key={val}
                              onClick={() => available && selectAttr(dim, val)}
                              disabled={!available}
                              className={`relative px-4 py-2 rounded-sm text-sm font-semibold border transition-colors ${
                                isSelected
                                  ? "bg-[var(--red)] border-[var(--red)] text-white"
                                  : available
                                  ? "bg-[var(--card)] border-[var(--line)] text-[var(--ink)]/80 hover:border-[var(--red)]/50 hover:text-[var(--ink)]"
                                  : "bg-[var(--card)] border-[var(--line)] text-[var(--muted)] cursor-not-allowed opacity-50"
                              }`}
                            >
                              <span className="flex items-center gap-2">
                                {isColor && (
                                  <span
                                    className="w-3.5 h-3.5 rounded-full border border-white/20 flex-shrink-0"
                                    style={{ backgroundColor: val.toLowerCase() }}
                                  />
                                )}
                                {val}
                              </span>
                              {!available && (
                                <span className="absolute inset-0 flex items-center justify-center pointer-events-none">
                                  <span className="w-full h-px bg-[var(--line)] rotate-[20deg] absolute" />
                                </span>
                              )}
                            </button>
                          );
                        })}
                      </div>
                    )}
                  </div>
                );
              })}

              {/* No match / out of stock notice */}
              {!resolvedVariant && (
                <div className="flex items-center gap-2 text-[var(--sig-warn-fg)] text-xs bg-[var(--sig-warn-bg)] border border-[var(--sig-warn-bd)] rounded-sm px-3 py-2">
                  <AlertTriangle size={12} />
                  This combination is unavailable. Please select a different option.
                </div>
              )}
              {outOfStock && resolvedVariant && (
                <div className="flex items-center gap-2 text-[var(--sig-warn-fg)] text-xs bg-[var(--sig-warn-bg)] border border-[var(--sig-warn-bd)] rounded-sm px-3 py-2">
                  <AlertTriangle size={12} />
                  This variant is currently out of stock.
                </div>
              )}
            </div>
          )}

          {/* ── Pricing ── */}
          {isDealer ? (
            <div className="bg-[var(--card)] border border-[var(--line)] rounded-sm p-6 mb-6">
              <div className="flex items-baseline gap-6 mb-3 flex-wrap">
                <div>
                  <div className="text-[var(--muted)] text-xs uppercase tracking-widest mb-1">Wholesale Price (excl. GST)</div>
                  <div className="tnum font-display text-3xl font-bold text-[var(--red)]">{formatCurrency(activePrice)}</div>
                </div>
                <div>
                  <div className="text-[var(--muted)] text-xs uppercase tracking-widest mb-1">Incl. {product.gstRate}% GST</div>
                  <div className="tnum text-xl font-bold text-[var(--ink)]">{formatCurrency(priceWithGST)}</div>
                </div>
                {activeMrp && activeMrp > activePrice && (
                  <div>
                    <div className="text-[var(--muted)] text-xs uppercase tracking-widest mb-1">MRP</div>
                    <div className="tnum text-lg font-bold text-[var(--muted)] line-through">{formatCurrency(activeMrp)}</div>
                  </div>
                )}
              </div>
              {activeMrp && activeMrp > activePrice && (
                <div className="flex items-center gap-2 mb-3 bg-[var(--sig-ok-bg)] border border-[var(--sig-ok-bd)] rounded-sm px-3 py-1.5 w-fit">
                  <Tag size={11} className="text-[var(--sig-ok-fg)]" />
                  <span className="text-[var(--sig-ok-fg)] text-xs font-semibold">
                    {Math.round(((activeMrp - activePrice) / activeMrp) * 100)}% off MRP — Exclusive wholesale price
                  </span>
                </div>
              )}
              <div className="border-t border-[var(--line)] pt-3 mt-1 space-y-1">
                <div className="flex justify-between text-xs text-[var(--muted)]">
                  <span>Base × {quantity} pcs</span>
                  <span className="tnum">{formatCurrency(activePrice * quantity)}</span>
                </div>
                <div className="flex justify-between text-xs text-[var(--muted)]">
                  <span>GST ({product.gstRate}%)</span>
                  <span className="tnum">{formatCurrency(activePrice * quantity * product.gstRate / 100)}</span>
                </div>
                <div className="flex justify-between text-sm font-bold text-[var(--ink)] pt-1 border-t border-[var(--line)]">
                  <span>Total for {quantity} pcs (excl. shipping)</span>
                  <span className="tnum text-[var(--red)]">{formatCurrency(priceWithGST * quantity)}</span>
                </div>
              </div>
            </div>
          ) : (
            <div className="bg-[var(--card)] border border-[var(--line)] rounded-sm p-6 mb-6">
              <div className="flex items-baseline gap-6 mb-3 flex-wrap">
                <div>
                  <div className="text-[var(--muted)] text-xs uppercase tracking-widest mb-1">Wholesale Price</div>
                  <div className="tnum font-display text-3xl font-bold text-[var(--red)]">{formatCurrency(activePrice)}</div>
                </div>
                {activeMrp && activeMrp > activePrice && (
                  <div>
                    <div className="text-[var(--muted)] text-xs uppercase tracking-widest mb-1">MRP</div>
                    <div className="tnum text-xl font-bold text-[var(--muted)] line-through">{formatCurrency(activeMrp)}</div>
                  </div>
                )}
              </div>
              {activeMrp && activeMrp > activePrice && (
                <div className="flex items-center gap-2 mb-3 bg-[var(--sig-ok-bg)] border border-[var(--sig-ok-bd)] rounded-sm px-3 py-1.5 w-fit">
                  <Tag size={11} className="text-[var(--sig-ok-fg)]" />
                  <span className="text-[var(--sig-ok-fg)] text-xs font-semibold">
                    {Math.round(((activeMrp - activePrice) / activeMrp) * 100)}% off MRP — Exclusive wholesale price
                  </span>
                </div>
              )}
              <div className="flex items-center gap-2 mt-3 border border-[var(--red)]/25 rounded-sm px-3 py-2 w-fit">
                <Lock size={12} className="text-[var(--red)] flex-shrink-0" />
                <span className="text-[var(--red)] text-xs font-semibold">Login as Dealer to place orders</span>
              </div>
            </div>
          )}

          {/* ── Quantity + Add to Cart ── */}
          {isDealer && (
            <div className="flex items-center gap-4">
              <div className="flex items-center bg-[var(--card)] border border-[var(--line)] rounded-sm overflow-hidden">
                <button
                  onClick={() => setQuantity(Math.max(activeMoq, quantity - activeMoq))}
                  className="px-4 py-3 text-[var(--muted)] hover:text-[var(--ink)] hover:bg-[var(--paper)] transition-colors"
                >
                  <Minus size={14} />
                </button>
                <input
                  type="number"
                  value={quantity}
                  min={activeMoq}
                  max={maxOrderQty > 0 ? maxOrderQty : undefined}
                  step={activeMoq}
                  onChange={(e) => {
                    const v = parseInt(e.target.value, 10);
                    if (!isNaN(v) && v > 0) setQuantity(v);
                  }}
                  onBlur={(e) => {
                    const v = parseInt(e.target.value, 10);
                    if (isNaN(v) || v <= 0) { setQuantity(activeMoq); return; }
                    // Snap to nearest multiple of MOQ, minimum 1× MOQ, capped at available stock
                    const snapped = Math.max(activeMoq, Math.round(v / activeMoq) * activeMoq);
                    setQuantity(maxOrderQty > 0 ? Math.min(snapped, maxOrderQty) : snapped);
                  }}
                  className="tnum w-16 text-center text-[var(--ink)] font-bold bg-transparent focus:outline-none py-3 [appearance:textfield] [&::-webkit-outer-spin-button]:appearance-none [&::-webkit-inner-spin-button]:appearance-none"
                />
                <button
                  onClick={() => setQuantity(maxOrderQty > 0 ? Math.min(quantity + activeMoq, maxOrderQty) : quantity)}
                  disabled={maxOrderQty > 0 && quantity >= maxOrderQty}
                  className="px-4 py-3 text-[var(--muted)] hover:text-[var(--ink)] hover:bg-[var(--paper)] disabled:opacity-30 disabled:cursor-not-allowed disabled:hover:bg-transparent transition-colors"
                >
                  <Plus size={14} />
                </button>
              </div>
              <button
                onClick={handleAddToCart}
                disabled={loading || addedToCart || (hasVariants && !resolvedVariant) || !!outOfStock}
                className={`flex-1 flex items-center justify-center gap-2 font-bold py-3 rounded-sm transition-colors text-sm uppercase tracking-wider ${
                  addedToCart
                    ? "bg-[var(--sig-ok-fg)] text-white"
                    : outOfStock
                    ? "bg-[var(--line)] text-[var(--muted)] cursor-not-allowed"
                    : hasVariants && !resolvedVariant
                    ? "bg-[var(--line)] text-[var(--muted)] cursor-not-allowed"
                    : "bg-[var(--red)] hover:bg-[var(--red-hover)] text-white"
                }`}
              >
                {addedToCart ? (
                  <><CheckCircle size={16} /> Added to Cart</>
                ) : loading ? "Adding..." : outOfStock ? "Out of Stock" : (
                  <><ShoppingCart size={16} /> Add to Cart</>
                )}
              </button>
            </div>
          )}

          {!isDealer && (
            <Link
              href="/login"
              className="block w-full text-center bg-[var(--red)] hover:bg-[var(--red-hover)] text-white font-bold py-3 rounded-sm transition-colors text-sm uppercase tracking-wider"
            >
              Login as Dealer to Order
            </Link>
          )}
        </div>
      </div>

      {/* Related Products */}
      {relatedProducts.length > 0 && (
        <div>
          <div className="flex items-end justify-between mb-8 gap-4 flex-wrap">
            <h2 className="font-display text-2xl font-bold text-[var(--ink)]">
              {vehicleContext ? (
                <>More parts for <span className="text-[var(--red)]">{vehicleContext.name}</span></>
              ) : (
                <>More from <span className="text-[var(--red)]">{product.category.name}</span></>
              )}
            </h2>
            {vehicleContext && (
              <Link
                href={`/products?vehicle=${vehicleContext.slug}`}
                className="text-[var(--red)] hover:text-[var(--red-hover)] text-xs font-bold uppercase tracking-wider transition-colors"
              >
                View all →
              </Link>
            )}
          </div>
          <div className="grid grid-cols-2 md:grid-cols-4 gap-px bg-[var(--line)] border border-[var(--line)]">
            {relatedProducts.map((p) => {
              const thumb = getRelatedThumb(p);
              return (
                <Link
                  key={p.id}
                  href={`/products/${p.slug}${vehicleContext ? `?vehicle=${vehicleContext.slug}` : ""}`}
                  className="group bg-[var(--card)] hover:bg-[var(--paper)] transition-colors block"
                >
                  <div className="relative h-36 bg-[var(--paper)] border-b border-[var(--line)]">
                    {thumb ? (
                      <Image src={thumb} alt={p.name} fill className="object-cover" sizes="300px" unoptimized />
                    ) : (
                      <div className="w-full h-full flex items-center justify-center">
                        <div className="text-4xl text-[var(--line)] font-black">◈</div>
                      </div>
                    )}
                  </div>
                  <div className="p-4">
                    <div className="text-[var(--muted)] text-[10px] font-mono mb-1">{p.partNumber}</div>
                    <h4 className="text-[var(--ink)] text-sm font-bold line-clamp-2 group-hover:text-[var(--red)] transition-colors">
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
