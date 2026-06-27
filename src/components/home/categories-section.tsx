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
    iconBg: "bg-slate-50 group-hover:bg-slate-100 border-slate-200",
    iconColor: "text-slate-500 group-hover:text-slate-700",
  },
  {
    name: "Mudguard",
    slug: "mudguard",
    description: "Front and rear mudguards engineered for precise OEM fitment and durability.",
    Icon: Shield,
    iconBg: "bg-red-50 group-hover:bg-red-100 border-red-100",
    iconColor: "text-red-500 group-hover:text-red-600",
  },
  {
    name: "Indicators",
    slug: "indicators",
    description: "Indicator assemblies and turn signal lamps for safe and compliant riding.",
    Icon: Radio,
    iconBg: "bg-orange-50 group-hover:bg-orange-100 border-orange-100",
    iconColor: "text-orange-500 group-hover:text-orange-600",
  },
  {
    name: "Brake Parts",
    slug: "brake-parts",
    description: "Disc brakes, drum brakes, brake pads, and caliper assemblies for maximum stopping power.",
    Icon: Disc2,
    iconBg: "bg-slate-50 group-hover:bg-red-50 border-slate-200 group-hover:border-red-100",
    iconColor: "text-slate-500 group-hover:text-red-500",
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
            className="mt-6 md:mt-0 group flex items-center gap-2 text-red-500 hover:text-red-600 font-semibold text-sm uppercase tracking-wider transition-colors"
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
              <TiltCard key={cat.slug} intensity={8}>
                <Link
                  href={`/products?category=${cat.slug}`}
                  className="group relative overflow-hidden rounded-2xl block bg-white border border-gray-100 shadow-sm hover:shadow-xl hover:border-red-200/80 hover:-translate-y-0.5 transition-all duration-300"
                >
                  {/* Hover tint */}
                  <div className="absolute inset-0 bg-gradient-to-br from-red-50/0 to-red-50/0 group-hover:from-red-50/60 group-hover:to-white transition-all duration-500 rounded-2xl" />
                  {/* Top accent line */}
                  <div className="absolute top-0 left-0 right-0 h-px bg-gradient-to-r from-transparent via-red-200/60 to-transparent" />

                  <div className="relative z-10 p-7 flex gap-6 items-start">
                    <div
                      className={`flex-shrink-0 w-14 h-14 rounded-xl flex items-center justify-center transition-all duration-300 border ${cat.iconBg}`}
                    >
                      <cat.Icon size={26} className={`transition-colors duration-300 ${cat.iconColor}`} />
                    </div>

                    <div className="flex-1 min-w-0">
                      <div className="flex items-center justify-between mb-2">
                        <h3 className="text-xl font-bold text-gray-900">{cat.name}</h3>
                        <ChevronRight size={18} className="text-gray-300 group-hover:text-red-500 group-hover:translate-x-1 transition-all flex-shrink-0" />
                      </div>
                      <p className="text-gray-500 group-hover:text-gray-600 text-sm leading-relaxed mb-5 transition-colors">
                        {cat.description}
                      </p>
                      {count > 0 && (
                        <div className="inline-flex items-center gap-2 rounded-full px-3 py-1 bg-red-50 border border-red-100">
                          <span className="text-red-600 font-black text-base">{count}+</span>
                          <span className="text-red-400 text-[10px] uppercase tracking-widest">Products</span>
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
