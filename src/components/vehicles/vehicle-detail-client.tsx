"use client";

import { useMemo, useState } from "react";
import dynamic from "next/dynamic";
import Link from "next/link";
import Image from "next/image";
import { useSession } from "next-auth/react";
import { ArrowRight, Lock, CheckCircle2, AlertTriangle, HelpCircle } from "lucide-react";
import { VariantSelector } from "@/components/vehicles/variant-selector";
import { SectionNav } from "@/components/vehicles/section-nav";
import { PartsDiagram } from "@/components/vehicles/parts-diagram";
import { Spin360Viewer } from "@/components/vehicles/spin-360-viewer";

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
  selection,
}: {
  vehicle: VehicleData;
  categorySlug: string;
  sections: SectionData[];
  compatibleProducts: CompatibleProduct[];
  compatibleCount: number;
  selection: SelectionState;
}) {
  const { data: session } = useSession();
  const isDealer = session?.user?.role === "DEALER";
  const [selectedColorId, setSelectedColorId] = useState<string | null>(vehicle.colors[0]?.id ?? null);

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
          {heroSrc ? (
            <Image src={heroSrc} alt={vehicle.name} fill className="object-cover" unoptimized priority />
          ) : (
            <div className="text-8xl text-red-500/10 font-black">◈</div>
          )}
          <div className="absolute inset-0 bg-gradient-to-t from-[var(--bg-primary)] via-transparent to-transparent" />
        </div>
        <div className="max-w-7xl mx-auto px-4 md:px-8 -mt-16 relative z-10 pb-8">
          <Link
            href={`/vehicles/${categorySlug}`}
            className="text-[var(--text-muted)] hover:text-red-500 text-xs uppercase tracking-widest font-semibold"
          >
            ← Back
          </Link>
          <div className="flex items-center gap-3 mt-3 mb-2">
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
              {vehicle.gallery.map((g) => (
                <div key={g.id} className="relative h-40 rounded-xl overflow-hidden bg-[var(--bg-secondary)]">
                  <Image src={g.imageUrl} alt={vehicle.name} fill className="object-cover" unoptimized />
                </div>
              ))}
            </div>
          )}
        </div>
      </section>

      {/* 360 spin viewer */}
      {activeSpin && (
        <section className="py-12 px-4 md:px-8 border-b border-[var(--border-color)]">
          <div className="max-w-7xl mx-auto">
            <h2 className="text-xl font-bold text-[var(--text-primary)] mb-5">360° View</h2>
            <Spin360Viewer frameUrls={activeSpin.frameUrls} />
          </div>
        </section>
      )}

      {/* 3D Viewer */}
      <section className="py-12 px-4 md:px-8 border-b border-[var(--border-color)]">
        <div className="max-w-7xl mx-auto">
          <h2 className="text-xl font-bold text-[var(--text-primary)] mb-5">Interactive 3D Viewer</h2>
          <VehicleViewer modelUrl={activeModelUrl} colorHex={selectedColor?.hex} />
        </div>
      </section>

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
          <div className="flex items-center justify-between mb-6 gap-4 flex-wrap">
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

          {sections.length > 0 && (
            <div className="mb-6">
              <SectionNav sections={sections} selectedSectionSlug={selection.sectionSlug} />
            </div>
          )}

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
    </div>
  );
}
