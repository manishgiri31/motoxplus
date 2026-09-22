import Link from "next/link";
import { ArrowRight, PackageX } from "lucide-react";
import { Img, MediaFrame } from "@/components/ui/media";
import { CornerFrame, Hatch, SpecTable, TechnicalLabel, type SpecRow } from "@/components/ui/technical";
import { Badge } from "@/components/ui/badge";
import { Reveal } from "@/components/ui/reveal";
import { Button } from "@/components/ui/button";
import { Money } from "@/components/ui/numeral";
import { cn } from "@/lib/utils";
import type { Tone } from "@/lib/status";

export type ProductShowcaseAvailability = "in-stock" | "low-stock" | "out-of-stock" | "made-to-order";

const AVAILABILITY_META: Record<ProductShowcaseAvailability, { label: string; tone: Tone }> = {
  "in-stock": { label: "In Stock", tone: "ok" },
  "low-stock": { label: "Low Stock", tone: "warn" },
  "out-of-stock": { label: "Out of Stock", tone: "danger" },
  "made-to-order": { label: "Made to Order", tone: "info" },
};

export interface ProductShowcaseItem {
  id: string;
  name: string;
  sku: string;
  category?: string;
  /** e.g. "Compatible with Splendor, HF Deluxe, Passion Pro" */
  application?: string;
  image?: string | null;
  imageAlt?: string;
  specs?: SpecRow[];
  availability?: ProductShowcaseAvailability;
  /** Omit to hide pricing entirely — e.g. on public pages where pricing is dealer-only. */
  price?: number | null;
  href?: string;
  ctaLabel?: string;
}

export interface ProductShowcaseProps {
  product: ProductShowcaseItem;
  theme?: "light" | "dark";
  /** Mirrors the image/content columns for an alternating editorial rhythm. */
  reverse?: boolean;
  className?: string;
}

/**
 * A premium single-product presentation — large photography, SKU/spec
 * overlay, a technical spec table — not a catalogue grid card. Takes real
 * product data through props; renders the existing "image pending" texture
 * (Hatch, not a broken <img>) when no photo is available yet.
 */
export function ProductShowcase({ product, theme = "light", reverse, className }: ProductShowcaseProps) {
  const availability = product.availability ? AVAILABILITY_META[product.availability] : null;
  const dark = theme === "dark";

  return (
    <div
      data-surface={dark ? "invert" : undefined}
      className={cn(
        "grid grid-cols-1 items-center gap-10 lg:grid-cols-2 lg:gap-16",
        dark && "bg-[var(--surface-0)] p-8 md:p-14",
        className
      )}
    >
      <Reveal className={reverse ? "lg:order-2" : undefined}>
        <MediaFrame aspect="4/3" className="relative">
          {product.image ? (
            <Img
              src={product.image}
              alt={product.imageAlt ?? product.name}
              fill
              sizes="(min-width: 1024px) 45vw, 100vw"
              className="object-cover"
            />
          ) : (
            <>
              <Hatch className="opacity-50" />
              <div className="absolute inset-0 flex flex-col items-center justify-center gap-2 text-[var(--text-faint)]">
                <PackageX size={22} aria-hidden />
                <span className="text-[10px] font-semibold uppercase tracking-eyebrow">Image Pending</span>
              </div>
            </>
          )}
          <CornerFrame size={16} className="pointer-events-none absolute inset-0" />
          <TechnicalLabel invert className="absolute left-4 top-4">
            SKU / {product.sku}
          </TechnicalLabel>
        </MediaFrame>
      </Reveal>

      <Reveal delay={0.1} className={reverse ? "lg:order-1" : undefined}>
        <div className="mb-4 flex flex-wrap items-center gap-3">
          {product.category && (
            <span className="text-[10px] font-semibold uppercase tracking-eyebrow text-[var(--muted)]">
              {product.category}
            </span>
          )}
          {availability && <Badge tone={availability.tone}>{availability.label}</Badge>}
        </div>

        <h3 className="mb-2 font-display text-2xl font-bold tracking-tight md:text-3xl">{product.name}</h3>
        {product.application && (
          <p className={cn("mb-6 text-sm", dark ? "text-white/60" : "text-[var(--muted)]")}>{product.application}</p>
        )}

        {product.specs && product.specs.length > 0 && <SpecTable rows={product.specs} className="mb-6" />}

        <div className="flex flex-wrap items-center gap-6">
          {product.price != null && <Money amount={product.price} className="font-display text-xl font-bold" />}
          {product.href && (
            // Always "brand" (red), never "solid" (--ink bg) — --ink isn't part of the
            // data-surface="invert" remap, so a "solid" button on a dark card would render
            // a near-black pill on a near-black background. Red reads on both.
            <Button asChild variant="brand" size="md">
              <Link href={product.href} className="group">
                {product.ctaLabel ?? "View Specification"}
                <ArrowRight size={14} className="transition-transform group-hover:translate-x-0.5" />
              </Link>
            </Button>
          )}
        </div>
      </Reveal>
    </div>
  );
}
