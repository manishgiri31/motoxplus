import Link from "next/link";
import { ArrowRight, Eye, Shield, Radio, Disc2, ChevronRight } from "lucide-react";
import { Eyebrow } from "@/components/ui/technical";
import { Card } from "@/components/ui/card";

const CATEGORIES = [
  {
    name: "Head Light Visor",
    slug: "head-light-visor",
    description: "Headlight visors and visor assemblies for all major two-wheeler models.",
    Icon: Eye,
  },
  {
    name: "Mudguard",
    slug: "mudguard",
    description: "Front and rear mudguards engineered for precise OEM fitment and durability.",
    Icon: Shield,
  },
  {
    name: "Indicators",
    slug: "indicators",
    description: "Indicator assemblies and turn signal lamps for safe and compliant riding.",
    Icon: Radio,
  },
  {
    name: "Brake Parts",
    slug: "brake-parts",
    description: "Disc brakes, drum brakes, brake pads, and caliper assemblies for maximum stopping power.",
    Icon: Disc2,
  },
];

interface Props {
  categoryCounts?: Record<string, number>;
}

export function CategoriesSection({ categoryCounts = {} }: Props) {
  return (
    <section className="py-20 md:py-28 px-4 md:px-8 bg-[var(--paper)]">
      <div className="max-w-7xl mx-auto">
        {/* Header */}
        <div className="flex flex-col md:flex-row md:items-end md:justify-between mb-12 gap-4">
          <div>
            <Eyebrow className="mb-4">Product Range</Eyebrow>
            <h2 className="font-display text-3xl md:text-4xl font-bold text-[var(--ink)] tracking-tight">
              Built for every system.
            </h2>
          </div>
          <Link
            href="/products"
            className="group flex items-center gap-2 text-[var(--red)] hover:text-[var(--red-hover)] font-semibold text-sm uppercase tracking-wider transition-colors"
          >
            View All Products
            <ArrowRight size={16} className="group-hover:translate-x-1 transition-transform" />
          </Link>
        </div>

        {/* Grid */}
        <div className="grid grid-cols-1 md:grid-cols-2 gap-px bg-[var(--line)] border border-[var(--line)]">
          {CATEGORIES.map((cat) => {
            const count = categoryCounts[cat.slug] ?? 0;
            return (
              <Link key={cat.slug} href={`/products?category=${cat.slug}`} className="group">
                <Card
                  interactive
                  className="h-full rounded-none border-0 flex gap-5 items-start"
                  pad="lg"
                >
                  <div className="flex-shrink-0 w-12 h-12 border border-[var(--line)] group-hover:border-[var(--red)] flex items-center justify-center transition-colors">
                    <cat.Icon size={22} className="text-[var(--muted)] group-hover:text-[var(--red)] transition-colors" />
                  </div>

                  <div className="flex-1 min-w-0">
                    <div className="flex items-center justify-between gap-2 mb-1.5">
                      <h3 className="font-display text-lg font-bold text-[var(--ink)]">{cat.name}</h3>
                      <ChevronRight size={17} className="text-[var(--line)] group-hover:text-[var(--red)] group-hover:translate-x-1 transition-all flex-shrink-0" />
                    </div>
                    <p className="text-[var(--muted)] text-sm leading-relaxed mb-3">
                      {cat.description}
                    </p>
                    {count > 0 && (
                      <span className="font-mono text-[var(--red)] text-xs font-semibold">
                        {count}+ SKUs
                      </span>
                    )}
                  </div>
                </Card>
              </Link>
            );
          })}
        </div>
      </div>
    </section>
  );
}
