import Link from "next/link";
import { ArrowRight } from "lucide-react";
import { MediaHero } from "@/components/ui/media-hero";
import { StatStrip } from "@/components/ui/stat-strip";
import { Button } from "@/components/ui/button";

export interface CinematicHeroProps {
  skuCount: number;
}

/** Section 01 — full-viewport cinematic hero over the real factory master shot. */
export function CinematicHero({ skuCount }: CinematicHeroProps) {
  return (
    <MediaHero
      media="home.hero.primary"
      eyebrow={<span className="text-[10px] font-semibold uppercase tracking-eyebrow">MotoXPlus India Private Limited</span>}
      headline={
        <>
          <span className="block">Engineered in India.</span>
          <span className="block text-[var(--red)]">Built for the road.</span>
        </>
      }
      description="Premium two-wheeler spare parts engineered to OEM specifications and supplied through a trusted dealer network across India."
      actions={
        <>
          <Button asChild variant="brand" size="lg">
            <Link href="/products" className="group">
              Explore Products
              <ArrowRight size={16} className="transition-transform group-hover:translate-x-0.5" />
            </Link>
          </Button>
          <Button asChild variant="ghost" size="lg" className="border-white/30 text-white hover:border-white hover:bg-white/10">
            <Link href="/become-dealer">Become a Dealer</Link>
          </Button>
        </>
      }
      metadata={
        <StatStrip
          invert
          className="border-t border-white/15 pt-8"
          items={[
            { key: "sku", value: skuCount, suffix: "+", label: "SKUs" },
            { key: "units", value: 10, suffix: "K+", label: "Units / Month" },
            { key: "qc", value: 98, suffix: "%", label: "QC Pass Rate" },
            { key: "states", value: 18, suffix: "+", label: "States" },
          ]}
        />
      }
    />
  );
}
