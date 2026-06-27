"use client";

import Link from "next/link";
import { ArrowRight, Eye, Shield, Radio, Disc2, ChevronRight } from "lucide-react";
import { TiltCard } from "@/components/3d/tilt-card";

const CATEGORIES = [
  {
    name: "Head Light Visor",
    slug: "head-light-visor",
    description: "Headlight visors and visor assemblies for all major two-wheeler models.",
    Icon: Eye,
    gradientDark: "from-zinc-900/70 via-zinc-900/30 to-black/80",
    iconBg: "bg-zinc-800/40 group-hover:bg-red-900/25",
    iconColor: "text-zinc-400 group-hover:text-red-400",
  },
  {
    name: "Mudguard",
    slug: "mudguard",
    description: "Front and rear mudguards engineered for precise OEM fitment and durability.",
    Icon: Shield,
    gradientDark: "from-red-950/50 via-red-950/20 to-black/80",
    iconBg: "bg-red-900/20 group-hover:bg-red-900/35",
    iconColor: "text-red-600 group-hover:text-red-400",
  },
  {
    name: "Indicators",
    slug: "indicators",
    description: "Indicator assemblies and turn signal lamps for safe and compliant riding.",
    Icon: Radio,
    gradientDark: "from-red-950/40 via-red-950/15 to-black/80",
    iconBg: "bg-red-900/15 group-hover:bg-red-900/30",
    iconColor: "text-red-700 group-hover:text-red-400",
  },
  {
    name: "Brake Parts",
    slug: "brake-parts",
    description: "Disc brakes, drum brakes, brake pads, and caliper assemblies for maximum stopping power.",
    Icon: Disc2,
    gradientDark: "from-zinc-900/60 via-zinc-900/25 to-black/80",
    iconBg: "bg-zinc-800/40 group-hover:bg-red-900/25",
    iconColor: "text-zinc-400 group-hover:text-red-400",
  },
];

interface Props {
  categoryCounts?: Record<string, number>;
}

export function CategoriesSection({ categoryCounts = {} }: Props) {
  return (
    <section className="py-24 px-4 md:px-8 bg-[var(--bg-primary)]">
      <div className="max-w-7xl mx-auto">
        {/* Header */}
        <div className="flex flex-col md:flex-row md:items-end md:justify-between mb-16">
          <div>
            <div className="flex items-center gap-3 mb-4">
              <div className="w-8 h-px bg-red-600" />
              <span className="text-red-500 text-xs font-semibold uppercase tracking-widest">
                Product Range
              </span>
            </div>
            <h2 className="text-4xl md:text-5xl font-black text-[var(--text-primary)] tracking-tight">
              Built For<br />
              <span className="text-gradient-red">Every System.</span>
            </h2>
          </div>
          <Link
            href="/products"
            className="mt-6 md:mt-0 group flex items-center gap-2 text-red-400 hover:text-red-300 font-semibold text-sm uppercase tracking-wider transition-colors"
          >
            View All Products
            <ArrowRight size={16} className="group-hover:translate-x-1 transition-transform" />
          </Link>
        </div>

        {/* Grid */}
        <div className="grid grid-cols-1 md:grid-cols-2 gap-5">
          {CATEGORIES.map((cat) => {
            const count = categoryCounts[cat.slug] ?? 0;
            return (
              <TiltCard key={cat.slug} intensity={10}>
                <Link
                  href={`/products?category=${cat.slug}`}
                  className="group relative overflow-hidden rounded-2xl block"
                  style={{
                    background: "linear-gradient(135deg, rgba(20,20,20,0.95) 0%, rgba(10,10,10,0.98) 100%)",
                    border: "1px solid rgba(255,255,255,0.08)",
                    boxShadow: "0 20px 60px rgba(0,0,0,0.5), inset 0 1px 0 rgba(255,255,255,0.06)",
                  }}
                >
                  <div className={`absolute inset-0 bg-gradient-to-br ${cat.gradientDark} opacity-70`} />
                  <div className="absolute top-0 right-0 w-56 h-56 bg-red-900/10 rounded-full blur-3xl opacity-0 group-hover:opacity-100 transition-opacity duration-500 pointer-events-none" />
                  {/* Metallic top edge */}
                  <div className="absolute top-0 left-0 right-0 h-px bg-gradient-to-r from-transparent via-white/20 to-transparent" />

                  <div className="relative z-10 p-7 flex gap-6 items-start">
                    <div
                      className={`flex-shrink-0 w-14 h-14 rounded-xl flex items-center justify-center transition-all duration-300 ${cat.iconBg}`}
                      style={{
                        border: "1px solid rgba(255,255,255,0.12)",
                        boxShadow: "0 4px 16px rgba(0,0,0,0.4), inset 0 1px 0 rgba(255,255,255,0.08)",
                      }}
                    >
                      <cat.Icon size={26} className={`transition-colors duration-300 ${cat.iconColor}`} />
                    </div>

                    <div className="flex-1 min-w-0">
                      <div className="flex items-center justify-between mb-2">
                        <h3 className="text-xl font-bold text-white">{cat.name}</h3>
                        <ChevronRight size={18} className="text-white/30 group-hover:text-red-400 group-hover:translate-x-1 transition-all flex-shrink-0" />
                      </div>
                      <p className="text-white/50 group-hover:text-white/65 text-sm leading-relaxed mb-5 transition-colors">
                        {cat.description}
                      </p>
                      {count > 0 && (
                        <div
                          className="inline-flex items-center gap-2 rounded-full px-3 py-1"
                          style={{ background: "rgba(220,38,38,0.1)", border: "1px solid rgba(220,38,38,0.25)" }}
                        >
                          <span className="text-red-400 font-black text-base">{count}+</span>
                          <span className="text-white/40 text-[10px] uppercase tracking-widest">Products</span>
                        </div>
                      )}
                    </div>
                  </div>

                  <div className="absolute bottom-0 left-0 h-[2px] w-0 group-hover:w-full bg-gradient-to-r from-red-600 via-red-400 to-transparent transition-all duration-500 rounded-b-2xl" />
                </Link>
              </TiltCard>
            );
          })}
        </div>
      </div>
    </section>
  );
}
