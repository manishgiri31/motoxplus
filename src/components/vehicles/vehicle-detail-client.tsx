"use client";

import { useEffect, useMemo, useRef, useState } from "react";
import dynamic from "next/dynamic";
import Link from "next/link";
import Image from "next/image";
import { useSession } from "next-auth/react";
import { AnimatePresence, motion } from "framer-motion";
import {
  ArrowRight, Lock, CheckCircle2, AlertTriangle, HelpCircle, ChevronRight, X, Expand,
  Star, ChevronDown, MessageCircle, Phone, PackageSearch, Wrench,
} from "lucide-react";
import { VariantSelector } from "@/components/vehicles/variant-selector";
import { SectionNav } from "@/components/vehicles/section-nav";
import { PartsDiagram } from "@/components/vehicles/parts-diagram";
import { Spin360Viewer } from "@/components/vehicles/spin-360-viewer";
import { VehicleImage } from "@/components/vehicles/vehicle-image";
import { categoryBySlug } from "@/lib/vehicle-categories";

const VehicleViewer = dynamic(
  () => import("@/components/vehicles/vehicle-viewer").then((m) => m.VehicleViewer),
  {
    ssr: false,
    loading: () => (
      <div className="w-full h-[420px] md:h-[520px] rounded-2xl glass border border-[var(--border-color)] flex items-center justify-center">
        <span className="text-[var(--text-muted)] text-sm">Loading 3D viewer…</span>
      </div>
    ),
  }
);

interface OemColorData {
  id: string;
  name: string;
  paintCode: string | null;
  colorCode: string | null;
  finish: string | null;
}

interface VehicleColorData {
  id: string;
  name: string;
  hex: string;
  image: string | null;
  oemColor: OemColorData | null;
}

interface VehicleGalleryImage {
  id: string;
  imageUrl: string;
}

interface VariantData {
  id: string;
  slug: string;
  name: string;
  generationId: string | null;
  emissionStandard: string | null;
  brakeType: string | null;
  startType: string | null;
  yearFrom: number | null;
  yearTo: number | null;
}

interface GenerationData {
  id: string;
  name: string;
  yearFrom: number;
  yearTo: number | null;
  variants: VariantData[];
}

interface DiagramHotspotData {
  id: string;
  x: number;
  y: number;
  label: string;
  calloutNumber: number | null;
  productId: string | null;
}

interface DiagramData {
  id: string;
  name: string;
  imageUrl: string;
  hotspots: DiagramHotspotData[];
}

interface Model3DData {
  id: string;
  variantId: string | null;
  colorId: string | null;
  url: string;
}

interface SpinData {
  id: string;
  variantId: string | null;
  colorId: string | null;
  frameUrls: string[];
}

interface SectionData {
  id: string;
  name: string;
  slug: string;
  icon: string | null;
}

interface VehicleData {
  id: string;
  name: string;
  slug: string;
  engineCc: number | null;
  launchYear: number | null;
  yearFrom: number | null;
  yearTo: number | null;
  heroImage: string | null;
  power: string | null;
  torque: string | null;
  mileage: string | null;
  weight: string | null;
  fuelTank: string | null;
  modelUrl: string | null;
  manufacturer: { name: string; logo: string | null };
  colors: VehicleColorData[];
  gallery: VehicleGalleryImage[];
  generations: GenerationData[];
  variants: VariantData[];
  diagrams: DiagramData[];
  model3d: Model3DData[];
  spins: SpinData[];
}

interface FitmentData {
  confidence: "VERIFIED" | "LIKELY" | "UNVERIFIED" | "INCOMPATIBLE";
  confidenceScore: number | null;
  sectionId: string | null;
  fitmentNote: string | null;
}

interface CompatibleProduct {
  id: string;
  name: string;
  partNumber: string;
  price: number;
  mrp: number | null;
  moq: number;
  images: string[];
  productImages?: { imageUrl: string; isPrimary: boolean }[];
  category: { name: string };
  fitment?: FitmentData;
}

interface SelectionState {
  generationId: string | null;
  variantSlug: string | null;
  year: number | null;
  sectionSlug: string | null;
}

interface ReviewData {
  id: string;
  rating: number;
  title: string | null;
  body: string;
  verifiedPurchase: boolean;
  createdAt: string;
  user: { name: string | null };
}

interface LinkedProductData {
  id: string;
  name: string;
  partNumber: string;
  price: number;
  stock: number;
  category: { name: string };
  productImages: { imageUrl: string }[];
}

interface AccessoryData {
  id: string;
  product: LinkedProductData;
}

interface RecommendationData {
  id: string;
  product: LinkedProductData;
}

interface FAQData {
  id: string;
  question: string;
  answer: string;
}

interface RelatedVehicleData {
  id: string;
  name: string;
  slug: string;
  category: string;
  heroImage: string | null;
  engineCc: number | null;
  manufacturer: { name: string; logo: string | null };
}

const CONFIDENCE_BADGE: Record<
  FitmentData["confidence"],
  { label: string; className: string; Icon: typeof CheckCircle2 }
> = {
  VERIFIED: { label: "Verified Fit", className: "bg-emerald-500/10 border-emerald-500/30 text-emerald-500", Icon: CheckCircle2 },
  LIKELY: { label: "Likely Fit", className: "bg-amber-500/10 border-amber-500/30 text-amber-500", Icon: AlertTriangle },
  UNVERIFIED: { label: "Unverified", className: "bg-[var(--bg-secondary)] border-[var(--border-color)] text-[var(--text-muted)]", Icon: HelpCircle },
  INCOMPATIBLE: { label: "Not Compatible", className: "bg-red-500/10 border-red-500/30 text-red-500", Icon: AlertTriangle },
};

export function VehicleDetailClient({
  vehicle,
  categorySlug,
  sections,
  compatibleProducts,
  compatibleCount,
  reviews,
  accessories,
  recommendations,
  faqs,
  relatedVehicles,
  selection,
}: {
  vehicle: VehicleData;
  categorySlug: string;
  sections: SectionData[];
  compatibleProducts: CompatibleProduct[];
  compatibleCount: number;
  reviews: ReviewData[];
  accessories: AccessoryData[];
  recommendations: RecommendationData[];
  faqs: FAQData[];
  relatedVehicles: RelatedVehicleData[];
  selection: SelectionState;
}) {
  const { data: session } = useSession();
  const isDealer = session?.user?.role === "DEALER";
  const [selectedColorId, setSelectedColorId] = useState<string | null>(vehicle.colors[0]?.id ?? null);
  const [lightboxIndex, setLightboxIndex] = useState<number | null>(null);
  const [openFaqId, setOpenFaqId] = useState<string | null>(null);
  const categoryLabel = categoryBySlug(categorySlug)?.label ?? categorySlug;
  const touchStartX = useRef<number | null>(null);

  const galleryLength = vehicle.gallery.length;
  const showNextImage = () => setLightboxIndex((i) => (i === null ? null : (i + 1) % galleryLength));
  const showPrevImage = () => setLightboxIndex((i) => (i === null ? null : (i - 1 + galleryLength) % galleryLength));

  useEffect(() => {
    if (lightboxIndex === null) return;
    const handler = (e: KeyboardEvent) => {
      if (e.key === "ArrowRight") showNextImage();
      else if (e.key === "ArrowLeft") showPrevImage();
      else if (e.key === "Escape") setLightboxIndex(null);
    };
    window.addEventListener("keydown", handler);
    return () => window.removeEventListener("keydown", handler);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [lightboxIndex, galleryLength]);

  const handleTouchStart = (e: React.TouchEvent) => {
    touchStartX.current = e.touches[0].clientX;
  };
  const handleTouchEnd = (e: React.TouchEvent) => {
    if (touchStartX.current === null) return;
    const delta = e.changedTouches[0].clientX - touchStartX.current;
    if (Math.abs(delta) > 50) {
      if (delta < 0) showNextImage();
      else showPrevImage();
    }
    touchStartX.current = null;
  };

  const selectedColor = vehicle.colors.find((c) => c.id === selectedColorId) ?? null;
  const heroSrc = selectedColor?.image || vehicle.heroImage;

  const allVariants = useMemo(
    () => [...vehicle.generations.flatMap((g) => g.variants), ...vehicle.variants],
    [vehicle.generations, vehicle.variants]
  );
  const selectedVariant = selection.variantSlug
    ? allVariants.find((v) => v.slug === selection.variantSlug) ?? null
    : null;

  const activeModelUrl = useMemo(() => {
    const candidates = vehicle.model3d.filter(
      (m) =>
        (!m.variantId || m.variantId === selectedVariant?.id) &&
        (!m.colorId || m.colorId === selectedColorId)
    );
    const scored = candidates
      .map((m) => ({
        m,
        score: (m.variantId ? 2 : 0) + (m.colorId ? 1 : 0),
      }))
      .sort((a, b) => b.score - a.score);
    return scored[0]?.m.url ?? vehicle.modelUrl ?? null;
  }, [vehicle.model3d, vehicle.modelUrl, selectedVariant, selectedColorId]);

  const activeSpin = useMemo(() => {
    const candidates = vehicle.spins.filter(
      (s) =>
        (!s.variantId || s.variantId === selectedVariant?.id) &&
        (!s.colorId || s.colorId === selectedColorId)
    );
    return candidates.sort((a, b) => (b.colorId ? 1 : 0) - (a.colorId ? 1 : 0))[0] ?? null;
  }, [vehicle.spins, selectedVariant, selectedColorId]);

  const specs = useMemo(
    () =>
      [
        { label: "Engine", value: vehicle.engineCc ? `${vehicle.engineCc}cc` : null },
        { label: "Power", value: vehicle.power },
        { label: "Torque", value: vehicle.torque },
        { label: "Mileage", value: vehicle.mileage },
        { label: "Weight", value: vehicle.weight },
        { label: "Fuel Tank", value: vehicle.fuelTank },
        { label: "Launch Year", value: vehicle.launchYear ? String(vehicle.launchYear) : null },
        {
          label: "Compatible Years",
          value: vehicle.yearFrom ? `${vehicle.yearFrom}–${vehicle.yearTo ?? "present"}` : null,
        },
      ].filter((s) => s.value),
    [vehicle]
  );

  return (
    <div className="min-h-screen bg-[var(--bg-primary)]">
      {/* Hero */}
      <section className="relative border-b border-[var(--border-color)]">
        <div className="relative h-[46vh] min-h-[320px] bg-[var(--bg-secondary)] flex items-center justify-center overflow-hidden">
          <VehicleImage src={heroSrc} alt={vehicle.name} priority logId={vehicle.slug} className="object-cover" />
          <div className="absolute inset-0 bg-gradient-to-t from-[var(--bg-primary)] via-transparent to-transparent" />
        </div>
        <div className="max-w-7xl mx-auto px-4 md:px-8 -mt-16 relative z-10 pb-8">
          <nav aria-label="Breadcrumb" className="flex items-center flex-wrap gap-1.5 text-xs uppercase tracking-widest font-semibold mb-4">
            <Link href="/" className="text-[var(--text-muted)] hover:text-red-500 transition-colors">
              Home
            </Link>
            <ChevronRight size={12} className="text-[var(--text-muted)]/50 flex-shrink-0" />
            <Link href="/vehicles" className="text-[var(--text-muted)] hover:text-red-500 transition-colors">
              Vehicles
            </Link>
            <ChevronRight size={12} className="text-[var(--text-muted)]/50 flex-shrink-0" />
            <Link href={`/vehicles/${categorySlug}`} className="text-[var(--text-muted)] hover:text-red-500 transition-colors">
              {categoryLabel}
            </Link>
            <ChevronRight size={12} className="text-[var(--text-muted)]/50 flex-shrink-0" />
            <span className="text-red-500">{vehicle.name}</span>
          </nav>
          <div className="flex items-center gap-3 mb-2">
            {vehicle.manufacturer.logo && (
              <Image
                src={vehicle.manufacturer.logo}
                alt={vehicle.manufacturer.name}
                width={64}
                height={24}
                className="object-contain h-6 w-auto bg-white/90 rounded px-1.5 py-1"
                unoptimized
              />
            )}
            <span className="text-[var(--text-muted)] text-xs uppercase tracking-widest font-semibold">
              {vehicle.manufacturer.name}
            </span>
          </div>
          <h1 className="text-4xl md:text-6xl font-black text-[var(--text-primary)] tracking-tight">
            {vehicle.name}
          </h1>
        </div>
      </section>

      {/* Generation / Variant / Year selector */}
      {(vehicle.generations.length > 0 || vehicle.variants.length > 0) && (
        <section className="py-8 px-4 md:px-8 border-b border-[var(--border-color)]">
          <div className="max-w-7xl mx-auto">
            <VariantSelector
              generations={vehicle.generations}
              ungroupedVariants={vehicle.variants}
              selectedGenerationId={selection.generationId}
              selectedVariantSlug={selection.variantSlug}
              selectedYear={selection.year}
            />
          </div>
        </section>
      )}

      {/* Specs */}
      {specs.length > 0 && (
        <section className="py-12 px-4 md:px-8 border-b border-[var(--border-color)]">
          <div className="max-w-7xl mx-auto grid grid-cols-2 md:grid-cols-4 gap-4">
            {specs.map((s) => (
              <div key={s.label} className="glass border border-[var(--border-color)] rounded-xl p-4">
                <div className="text-[var(--text-muted)] text-[10px] uppercase tracking-widest mb-1">{s.label}</div>
                <div className="text-[var(--text-primary)] font-bold text-lg">{s.value}</div>
              </div>
            ))}
          </div>
        </section>
      )}

      {/* Colors */}
      <section className="py-12 px-4 md:px-8 border-b border-[var(--border-color)]">
        <div className="max-w-7xl mx-auto">
          <h2 className="text-xl font-bold text-[var(--text-primary)] mb-5">Available Colors</h2>
          {vehicle.colors.length === 0 ? (
            <p className="text-[var(--text-muted)] text-sm">Color options coming soon.</p>
          ) : (
            <div className="flex flex-wrap gap-4">
              {vehicle.colors.map((c) => (
                <button
                  key={c.id}
                  onClick={() => setSelectedColorId(c.id)}
                  className="flex flex-col items-center gap-2 group"
                >
                  <span
                    className={`w-12 h-12 rounded-full border-2 transition-all ${
                      selectedColorId === c.id ? "border-red-500 scale-110" : "border-[var(--border-color)]"
                    }`}
                    style={{ backgroundColor: c.hex }}
                  />
                  <span
                    className={`text-xs font-semibold ${
                      selectedColorId === c.id ? "text-red-500" : "text-[var(--text-muted)]"
                    }`}
                  >
                    {c.name}
                  </span>
                  {c.oemColor?.paintCode && (
                    <span className="text-[9px] text-[var(--text-muted)] font-mono">{c.oemColor.paintCode}</span>
                  )}
                </button>
              ))}
            </div>
          )}
        </div>
      </section>

      {/* Gallery */}
      <section className="py-12 px-4 md:px-8 border-b border-[var(--border-color)]">
        <div className="max-w-7xl mx-auto">
          <h2 className="text-xl font-bold text-[var(--text-primary)] mb-5">Gallery</h2>
          {vehicle.gallery.length === 0 ? (
            <p className="text-[var(--text-muted)] text-sm">Gallery images coming soon.</p>
          ) : (
            <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
              {vehicle.gallery.map((g, i) => (
                <button
                  key={g.id}
                  onClick={() => setLightboxIndex(i)}
                  className="group relative h-40 rounded-xl overflow-hidden bg-[var(--bg-secondary)] shadow-sm hover:shadow-lg transition-shadow duration-300"
                >
                  <Image
                    src={g.imageUrl}
                    alt={`${vehicle.name} — photo ${i + 1}`}
                    fill
                    className="object-cover transition-transform duration-500 group-hover:scale-110"
                    unoptimized
                  />
                  <div className="absolute inset-0 bg-black/0 group-hover:bg-black/30 transition-colors duration-300 flex items-center justify-center">
                    <Expand size={20} className="text-white opacity-0 group-hover:opacity-100 transition-opacity" />
                  </div>
                </button>
              ))}
            </div>
          )}
        </div>
      </section>

      {/* Gallery lightbox */}
      <AnimatePresence>
        {lightboxIndex !== null && (
          <motion.div
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            className="fixed inset-0 z-[100] bg-black/90 backdrop-blur-sm flex items-center justify-center p-4 md:p-12"
            onClick={() => setLightboxIndex(null)}
            onTouchStart={handleTouchStart}
            onTouchEnd={handleTouchEnd}
          >
            <button
              onClick={() => setLightboxIndex(null)}
              aria-label="Close gallery"
              className="absolute top-5 right-5 w-11 h-11 rounded-full bg-white/10 hover:bg-white/20 flex items-center justify-center text-white transition-colors"
            >
              <X size={20} />
            </button>
            {vehicle.gallery.length > 1 && (
              <>
                <button
                  onClick={(e) => {
                    e.stopPropagation();
                    showPrevImage();
                  }}
                  aria-label="Previous photo"
                  className="hidden md:flex absolute left-5 top-1/2 -translate-y-1/2 w-11 h-11 rounded-full bg-white/10 hover:bg-white/20 items-center justify-center text-white transition-colors"
                >
                  <ChevronRight size={20} className="rotate-180" />
                </button>
                <button
                  onClick={(e) => {
                    e.stopPropagation();
                    showNextImage();
                  }}
                  aria-label="Next photo"
                  className="hidden md:flex absolute right-5 top-1/2 -translate-y-1/2 w-11 h-11 rounded-full bg-white/10 hover:bg-white/20 items-center justify-center text-white transition-colors"
                >
                  <ChevronRight size={20} />
                </button>
              </>
            )}
            <motion.div
              key={lightboxIndex}
              initial={{ opacity: 0, scale: 0.96 }}
              animate={{ opacity: 1, scale: 1 }}
              transition={{ duration: 0.2 }}
              className="relative w-full max-w-4xl h-[70vh]"
              onClick={(e) => e.stopPropagation()}
            >
              <Image
                src={vehicle.gallery[lightboxIndex].imageUrl}
                alt={`${vehicle.name} — photo ${lightboxIndex + 1}`}
                fill
                className="object-contain"
                unoptimized
              />
            </motion.div>
            {vehicle.gallery.length > 1 && (
              <div className="absolute bottom-6 left-1/2 -translate-x-1/2 flex gap-2">
                {vehicle.gallery.map((_, i) => (
                  <button
                    key={i}
                    onClick={(e) => {
                      e.stopPropagation();
                      setLightboxIndex(i);
                    }}
                    className={`h-1.5 rounded-full transition-all ${
                      i === lightboxIndex ? "w-6 bg-red-500" : "w-1.5 bg-white/30 hover:bg-white/50"
                    }`}
                  />
                ))}
              </div>
            )}
          </motion.div>
        )}
      </AnimatePresence>

      {/* Interactive viewer — 3D model takes priority over 360° spin. Hidden
          entirely when neither exists; the Gallery section above already
          covers the "show real photos instead" fallback. */}
      {(activeModelUrl || activeSpin) && (
        <section className="py-12 px-4 md:px-8 border-b border-[var(--border-color)]">
          <div className="max-w-7xl mx-auto">
            <h2 className="text-xl font-bold text-[var(--text-primary)] mb-5">
              {activeModelUrl ? "Interactive 3D Viewer" : "360° View"}
            </h2>
            {activeModelUrl ? (
              <VehicleViewer modelUrl={activeModelUrl} />
            ) : (
              <Spin360Viewer frameUrls={activeSpin!.frameUrls} />
            )}
          </div>
        </section>
      )}

      {/* Interactive parts diagram */}
      {vehicle.diagrams.length > 0 && (
        <section className="py-12 px-4 md:px-8 border-b border-[var(--border-color)]">
          <div className="max-w-7xl mx-auto">
            <h2 className="text-xl font-bold text-[var(--text-primary)] mb-5">Interactive Parts Diagram</h2>
            <PartsDiagram diagrams={vehicle.diagrams} />
          </div>
        </section>
      )}

      {/* Compatible Parts */}
      <section className="py-12 px-4 md:px-8">
        <div className="max-w-7xl mx-auto">
          <div className="sticky top-[72px] md:top-[88px] z-30 -mx-4 md:-mx-8 px-4 md:px-8 py-4 bg-[var(--bg-primary)]/90 backdrop-blur-xl border-b border-[var(--border-color)] mb-6">
            <div className="flex items-center justify-between mb-4 gap-4 flex-wrap">
              <h2 className="text-xl font-bold text-[var(--text-primary)]">Compatible Parts</h2>
              {compatibleCount > 0 && (
                <Link
                  href={`/products?vehicle=${vehicle.slug}${selection.variantSlug ? `&variant=${selection.variantSlug}` : ""}${selection.sectionSlug ? `&section=${selection.sectionSlug}` : ""}`}
                  className="group flex items-center gap-2 text-red-500 hover:text-red-600 font-semibold text-sm uppercase tracking-wider transition-colors"
                >
                  View all {compatibleCount} compatible parts
                  <ArrowRight size={16} className="group-hover:translate-x-1 transition-transform" />
                </Link>
              )}
            </div>

            {sections.length > 0 && <SectionNav sections={sections} selectedSectionSlug={selection.sectionSlug} />}
          </div>

          {compatibleProducts.length === 0 ? (
            <p className="text-[var(--text-muted)] text-sm">No compatible parts found yet for this model.</p>
          ) : (
            <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-4">
              {compatibleProducts.map((p) => {
                const thumb =
                  p.productImages && p.productImages.length > 0 ? p.productImages[0].imageUrl : p.images[0];
                const badge = p.fitment ? CONFIDENCE_BADGE[p.fitment.confidence] : null;
                return (
                  <Link
                    key={p.id}
                    href={`/products/${p.id}`}
                    className="group glass border border-[var(--border-color)] hover:border-red-900/40 rounded-2xl overflow-hidden transition-all duration-300 block"
                  >
                    <div className="relative h-40 bg-[var(--bg-secondary)] flex items-center justify-center overflow-hidden">
                      {thumb ? (
                        <Image
                          src={thumb}
                          alt={p.name}
                          fill
                          className="object-cover group-hover:scale-105 transition-transform duration-500"
                          sizes="280px"
                          unoptimized
                        />
                      ) : (
                        <div className="text-5xl text-red-500/20 font-black">◈</div>
                      )}
                      <div className="absolute top-3 left-3">
                        <span className="bg-red-600 text-white text-[10px] font-bold uppercase tracking-widest px-2.5 py-1 rounded-full">
                          {p.category.name}
                        </span>
                      </div>
                    </div>
                    <div className="p-4">
                      <h3 className="text-[var(--text-primary)] font-bold text-sm mb-2 line-clamp-2 group-hover:text-red-600 transition-colors">
                        {p.name}
                      </h3>
                      {badge && (
                        <div
                          className={`inline-flex items-center gap-1 mb-2 px-2 py-0.5 rounded-full border text-[9px] font-bold uppercase tracking-wider ${badge.className}`}
                        >
                          <badge.Icon size={10} />
                          {badge.label}
                        </div>
                      )}
                      <div className="pt-3 border-t border-[var(--border-color)] flex items-end justify-between">
                        <div>
                          <div className="text-red-500 font-black text-base leading-tight">
                            ₹{p.price.toLocaleString("en-IN", { maximumFractionDigits: 2 })}
                          </div>
                          {p.mrp && p.mrp > p.price && (
                            <span className="text-[var(--text-muted)] text-[10px] line-through">
                              MRP ₹{p.mrp.toLocaleString("en-IN")}
                            </span>
                          )}
                        </div>
                        {!isDealer && (
                          <div className="flex items-center gap-1.5 glass border border-red-500/20 rounded-full px-2 py-1">
                            <Lock size={9} className="text-red-500" />
                            <span className="text-red-500 text-[9px] font-bold">Login</span>
                          </div>
                        )}
                      </div>
                    </div>
                  </Link>
                );
              })}
            </div>
          )}
        </div>
      </section>

      {/* Recommended consumables */}
      <section className="py-12 px-4 md:px-8 border-t border-[var(--border-color)]">
        <div className="max-w-7xl mx-auto">
          <h2 className="text-xl font-bold text-[var(--text-primary)] mb-6">Recommended For This Vehicle</h2>
          {recommendations.length === 0 ? (
            <div className="glass border border-[var(--border-color)] rounded-2xl p-8 text-center">
              <PackageSearch size={24} className="text-[var(--text-muted)] mx-auto mb-3" />
              <p className="text-[var(--text-muted)] text-sm">
                No recommended products have been mapped to this vehicle yet.
              </p>
            </div>
          ) : (
            <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-4">
              {recommendations.map((r) => (
                <LinkedProductCard key={r.id} product={r.product} isDealer={isDealer} />
              ))}
            </div>
          )}
        </div>
      </section>

      {/* Compatible accessories */}
      <section className="py-12 px-4 md:px-8 border-t border-[var(--border-color)]">
        <div className="max-w-7xl mx-auto">
          <h2 className="text-xl font-bold text-[var(--text-primary)] mb-6">Compatible Accessories</h2>
          {accessories.length === 0 ? (
            <div className="glass border border-[var(--border-color)] rounded-2xl p-8 text-center">
              <Wrench size={24} className="text-[var(--text-muted)] mx-auto mb-3" />
              <p className="text-[var(--text-muted)] text-sm">
                Compatible accessories will appear here once available.
              </p>
            </div>
          ) : (
            <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-4">
              {accessories.map((a) => (
                <LinkedProductCard key={a.id} product={a.product} isDealer={isDealer} />
              ))}
            </div>
          )}
        </div>
      </section>

      {/* Reviews */}
      <section className="py-12 px-4 md:px-8 border-t border-[var(--border-color)]">
        <div className="max-w-7xl mx-auto">
          <h2 className="text-xl font-bold text-[var(--text-primary)] mb-6">Customer Reviews</h2>
          {reviews.length === 0 ? (
            <div className="glass border border-[var(--border-color)] rounded-2xl p-10 text-center">
              <Star size={24} className="text-[var(--text-muted)] mx-auto mb-3" />
              <p className="text-[var(--text-primary)] font-semibold mb-1">No customer reviews yet</p>
              <p className="text-[var(--text-muted)] text-sm">Be the first to share your experience.</p>
            </div>
          ) : (
            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              {reviews.map((r) => (
                <div key={r.id} className="glass border border-[var(--border-color)] rounded-2xl p-6">
                  <div className="flex items-center justify-between mb-3">
                    <div className="flex gap-0.5">
                      {Array.from({ length: 5 }).map((_, i) => (
                        <Star key={i} size={13} className={i < r.rating ? "fill-red-500 text-red-500" : "text-[var(--border-color)]"} />
                      ))}
                    </div>
                    {r.verifiedPurchase && (
                      <span className="flex items-center gap-1 text-[10px] font-bold uppercase tracking-wider text-emerald-500 bg-emerald-500/10 rounded-full px-2 py-0.5">
                        <CheckCircle2 size={10} /> Verified
                      </span>
                    )}
                  </div>
                  {r.title && <h3 className="text-[var(--text-primary)] font-bold text-sm mb-1.5">{r.title}</h3>}
                  <p className="text-[var(--text-secondary)] text-sm leading-relaxed mb-3">{r.body}</p>
                  <div className="text-[var(--text-muted)] text-xs">
                    {r.user.name || "Anonymous"} · {new Date(r.createdAt).toLocaleDateString("en-IN", { month: "short", year: "numeric" })}
                  </div>
                </div>
              ))}
            </div>
          )}
        </div>
      </section>

      {/* FAQ */}
      {faqs.length > 0 && (
        <section className="py-12 px-4 md:px-8 border-t border-[var(--border-color)]">
          <div className="max-w-4xl mx-auto">
            <h2 className="text-xl font-bold text-[var(--text-primary)] mb-6">Frequently Asked Questions</h2>
            <div className="space-y-2">
              {faqs.map((f) => (
                <div key={f.id} className="glass border border-[var(--border-color)] rounded-xl overflow-hidden">
                  <button
                    onClick={() => setOpenFaqId((id) => (id === f.id ? null : f.id))}
                    className="w-full flex items-center justify-between gap-4 px-5 py-4 text-left"
                  >
                    <span className="text-[var(--text-primary)] font-semibold text-sm">{f.question}</span>
                    <ChevronDown
                      size={16}
                      className={`flex-shrink-0 text-[var(--text-muted)] transition-transform ${openFaqId === f.id ? "rotate-180" : ""}`}
                    />
                  </button>
                  <AnimatePresence>
                    {openFaqId === f.id && (
                      <motion.div
                        initial={{ height: 0, opacity: 0 }}
                        animate={{ height: "auto", opacity: 1 }}
                        exit={{ height: 0, opacity: 0 }}
                        transition={{ duration: 0.2 }}
                        className="overflow-hidden"
                      >
                        <p className="px-5 pb-4 text-[var(--text-muted)] text-sm leading-relaxed">{f.answer}</p>
                      </motion.div>
                    )}
                  </AnimatePresence>
                </div>
              ))}
            </div>
          </div>
        </section>
      )}

      {/* Related vehicles */}
      {relatedVehicles.length > 0 && (
        <section className="py-12 px-4 md:px-8 border-t border-[var(--border-color)]">
          <div className="max-w-7xl mx-auto">
            <h2 className="text-xl font-bold text-[var(--text-primary)] mb-6">Related Vehicles</h2>
            <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-4 gap-4">
              {relatedVehicles.map((v) => (
                <Link
                  key={v.id}
                  href={`/vehicles/${categorySlug}/${v.slug}`}
                  className="group glass border border-[var(--border-color)] hover:border-red-900/40 rounded-2xl overflow-hidden transition-all duration-300 block"
                >
                  <div className="relative h-32 bg-[var(--bg-secondary)]">
                    <VehicleImage src={v.heroImage} alt={v.name} logId={v.slug} />
                  </div>
                  <div className="p-3">
                    <div className="text-[var(--text-muted)] text-[10px] uppercase tracking-widest font-semibold">{v.manufacturer.name}</div>
                    <h3 className="text-[var(--text-primary)] font-bold text-sm group-hover:text-red-600 transition-colors truncate">{v.name}</h3>
                  </div>
                </Link>
              ))}
            </div>
          </div>
        </section>
      )}

      {/* Contact CTA */}
      <section className="py-14 px-4 md:px-8 border-t border-[var(--border-color)] bg-[var(--bg-secondary)]">
        <div className="max-w-4xl mx-auto text-center">
          <h2 className="text-2xl md:text-3xl font-black text-[var(--text-primary)] mb-3">
            Need help finding parts for your {vehicle.name}?
          </h2>
          <p className="text-[var(--text-muted)] mb-8">Our team can help you identify the exact parts you need.</p>
          <div className="flex flex-col sm:flex-row items-center justify-center gap-3">
            <a
              href={`https://wa.me/${(process.env.NEXT_PUBLIC_COMPANY_WHATSAPP || "").replace(/\D/g, "")}?text=${encodeURIComponent(`Hi, I need help finding parts for my ${vehicle.name}`)}`}
              target="_blank"
              rel="noopener noreferrer"
              className="flex items-center gap-2 bg-emerald-600 hover:bg-emerald-700 text-white font-bold px-6 py-3 rounded-xl transition-colors text-sm uppercase tracking-wider"
            >
              <MessageCircle size={16} /> WhatsApp Us
            </a>
            <a
              href={`tel:${process.env.NEXT_PUBLIC_COMPANY_PHONE || ""}`}
              className="flex items-center gap-2 glass border border-[var(--border-color)] hover:border-red-600/40 text-[var(--text-primary)] font-bold px-6 py-3 rounded-xl transition-colors text-sm uppercase tracking-wider"
            >
              <Phone size={16} /> Call Now
            </a>
            <Link
              href="/contact"
              className="flex items-center gap-2 bg-red-600 hover:bg-red-700 text-white font-bold px-6 py-3 rounded-xl transition-colors text-sm uppercase tracking-wider"
            >
              Contact Dealer
            </Link>
          </div>
        </div>
      </section>
    </div>
  );
}

function LinkedProductCard({ product, isDealer }: { product: LinkedProductData; isDealer: boolean }) {
  const thumb = product.productImages[0]?.imageUrl;
  return (
    <Link
      href={`/products/${product.id}`}
      className="group glass border border-[var(--border-color)] hover:border-red-900/40 rounded-2xl overflow-hidden transition-all duration-300 block"
    >
      <div className="relative h-36 bg-[var(--bg-secondary)] flex items-center justify-center overflow-hidden">
        {thumb ? (
          <Image src={thumb} alt={product.name} fill className="object-cover group-hover:scale-105 transition-transform duration-500" sizes="240px" unoptimized />
        ) : (
          <div className="text-4xl text-red-500/20 font-black">◈</div>
        )}
      </div>
      <div className="p-3.5">
        <div className="text-[var(--text-muted)] text-[10px] uppercase tracking-widest mb-1 font-mono opacity-70">{product.partNumber}</div>
        <h3 className="text-[var(--text-primary)] font-bold text-sm mb-2 line-clamp-2 group-hover:text-red-600 transition-colors">{product.name}</h3>
        <div className="flex items-center justify-between">
          <span className="text-red-500 font-black text-sm">₹{product.price.toLocaleString("en-IN")}</span>
          {!isDealer && (
            <div className="flex items-center gap-1 glass border border-red-500/20 rounded-full px-2 py-0.5">
              <Lock size={8} className="text-red-500" />
              <span className="text-red-500 text-[9px] font-bold">Login</span>
            </div>
          )}
        </div>
      </div>
    </Link>
  );
}
