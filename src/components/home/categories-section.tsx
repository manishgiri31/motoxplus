"use client";

import Link from "next/link";
import { ArrowRight, Disc2, Wrench, SlidersVertical, Zap, ChevronRight } from "lucide-react";

const categories = [
  {
    name: "Brake Parts",
    slug: "brake-parts",
    description: "Disc brakes, drum brakes, brake pads, and caliper assemblies engineered for maximum stopping power.",
    count: "80+",
    Icon: Disc2,
    gradientDark: "from-red-950/50 via-red-950/20 to-black/80",
    gradientLight: "from-red-50 via-white to-gray-50",
    iconBg: "bg-red-900/20 group-hover:bg-red-900/35",
    iconColor: "text-red-600 group-hover:text-red-400",
  },
  {
    name: "Engine Parts",
    slug: "engine-parts",
    description: "Pistons, gaskets, bearings, and engine components built to OEM specifications for peak performance.",
    count: "120+",
    Icon: Wrench,
    gradientDark: "from-zinc-900/70 via-zinc-900/30 to-black/80",
    gradientLight: "from-zinc-50 via-white to-gray-50",
    iconBg: "bg-zinc-800/40 group-hover:bg-red-900/25",
    iconColor: "text-zinc-400 group-hover:text-red-400",
  },
  {
    name: "Suspension Parts",
    slug: "suspension-parts",
    description: "Shock absorbers, springs, fork seals, and linkages for smooth and controlled riding.",
    count: "60+",
    Icon: SlidersVertical,
    gradientDark: "from-red-950/40 via-red-950/15 to-black/80",
    gradientLight: "from-orange-50 via-white to-gray-50",
    iconBg: "bg-red-900/15 group-hover:bg-red-900/30",
    iconColor: "text-red-700 group-hover:text-red-400",
  },
  {
    name: "Electrical Parts",
    slug: "electrical-parts",
    description: "Stators, CDI units, switches, and wiring harnesses for reliable electrical systems.",
    count: "90+",
    Icon: Zap,
    gradientDark: "from-zinc-900/60 via-zinc-900/25 to-black/80",
    gradientLight: "from-yellow-50 via-white to-gray-50",
    iconBg: "bg-zinc-800/40 group-hover:bg-yellow-900/20",
    iconColor: "text-zinc-400 group-hover:text-yellow-400",
  },
];

export function CategoriesSection() {
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
          {categories.map((cat) => (
            <Link
              key={cat.slug}
              href={`/products?category=${cat.slug}`}
              className={`group relative overflow-hidden rounded-2xl bg-gradient-to-br dark:${cat.gradientDark} border border-[var(--border-color)] hover:border-red-700/50 transition-all duration-300 card-hover`}
              style={{
                background: `linear-gradient(135deg, var(--bg-card) 0%, transparent 100%)`,
              }}
            >
              {/* Gradient overlay */}
              <div className={`absolute inset-0 bg-gradient-to-br ${cat.gradientDark} opacity-80 dark:opacity-100 transition-opacity`} />

              {/* Hover glow */}
              <div className="absolute top-0 right-0 w-56 h-56 bg-red-900/10 rounded-full blur-3xl opacity-0 group-hover:opacity-100 transition-opacity duration-500 pointer-events-none" />

              <div className="relative z-10 p-7 flex gap-6 items-start">
                {/* Icon block */}
                <div className={`flex-shrink-0 w-14 h-14 rounded-xl border border-white/10 flex items-center justify-center transition-colors duration-300 ${cat.iconBg}`}>
                  <cat.Icon size={26} className={`transition-colors duration-300 ${cat.iconColor}`} />
                </div>

                {/* Content */}
                <div className="flex-1 min-w-0">
                  <div className="flex items-center justify-between mb-2">
                    <h3 className="text-xl font-bold text-white group-hover:text-white transition-colors">
                      {cat.name}
                    </h3>
                    <ChevronRight
                      size={18}
                      className="text-white/30 group-hover:text-red-400 group-hover:translate-x-1 transition-all flex-shrink-0"
                    />
                  </div>
                  <p className="text-white/50 group-hover:text-white/65 text-sm leading-relaxed mb-5 transition-colors">
                    {cat.description}
                  </p>
                  <div className="inline-flex items-center gap-2 glass rounded-full px-3 py-1 border border-white/10">
                    <span className="text-red-400 font-black text-base">{cat.count}</span>
                    <span className="text-white/40 text-[10px] uppercase tracking-widest">Products</span>
                  </div>
                </div>
              </div>

              {/* Bottom sweep */}
              <div className="absolute bottom-0 left-0 h-[2px] w-0 group-hover:w-full bg-gradient-to-r from-red-600 via-red-400 to-transparent transition-all duration-500 rounded-b-2xl" />
            </Link>
          ))}
        </div>
      </div>
    </section>
  );
}
