"use client";

import { useEffect, useState, Suspense, lazy } from "react";
import Link from "next/link";
import { ArrowRight, ChevronDown } from "lucide-react";

const HeroScene = lazy(() =>
  import("@/components/3d/hero-scene").then((m) => ({ default: m.HeroScene }))
);

const headlines: [string, string][] = [
  ["Engineered For", "Reliability."],
  ["Built For", "Every Journey."],
  ["Performance", "You Can Trust."],
];

interface Props {
  productCount?: number;
  categoryCount?: number;
}

export function HeroSection({ productCount = 700, categoryCount = 15 }: Props) {
  const [currentHeadline, setCurrentHeadline] = useState(0);
  const [isVisible, setIsVisible] = useState(false);
  const [mounted, setMounted] = useState(false);

  useEffect(() => {
    setIsVisible(true);
    setMounted(true);
    const interval = setInterval(() => {
      setCurrentHeadline((prev) => (prev + 1) % headlines.length);
    }, 4000);
    return () => clearInterval(interval);
  }, []);

  return (
    <section className="relative min-h-screen flex flex-col items-center justify-center overflow-hidden">
      {/* 3D Canvas Background */}
      <div className="absolute inset-0 z-0">
        <div className="absolute inset-0 bg-gradient-to-b from-[#020202] via-[#080202] to-[#050505]" />
        {mounted && (
          <Suspense fallback={null}>
            <div className="absolute inset-0">
              <HeroScene />
            </div>
          </Suspense>
        )}
        {/* Radial fade to blend 3D into page */}
        <div className="absolute inset-0 bg-[radial-gradient(ellipse_at_center,transparent_30%,#050505_80%)]" />
        <div className="absolute bottom-0 left-0 right-0 h-48 bg-gradient-to-t from-[var(--bg-primary)] to-transparent" />
      </div>

      {/* Noise grain texture */}
      <div
        className="absolute inset-0 z-[1] pointer-events-none opacity-[0.035]"
        style={{
          backgroundImage: `url("data:image/svg+xml,%3Csvg viewBox='0 0 256 256' xmlns='http://www.w3.org/2000/svg'%3E%3Cfilter id='noise'%3E%3CfeTurbulence type='fractalNoise' baseFrequency='0.9' numOctaves='4' stitchTiles='stitch'/%3E%3C/filter%3E%3Crect width='100%25' height='100%25' filter='url(%23noise)'/%3E%3C/svg%3E")`,
          backgroundSize: "180px",
        }}
      />

      {/* Content */}
      <div className="relative z-10 max-w-7xl mx-auto px-4 md:px-8 text-center">
        {/* Badge */}
        <div
          className={`inline-flex items-center gap-2.5 border border-red-900/50 rounded-full px-5 py-2 mb-10 transition-all duration-1000 ${
            isVisible ? "opacity-100 translate-y-0" : "opacity-0 translate-y-4"
          }`}
          style={{ background: "rgba(220,38,38,0.08)", backdropFilter: "blur(12px)" }}
        >
          <div className="w-2 h-2 bg-red-500 rounded-full animate-pulse" />
          <span className="text-red-400 text-xs font-semibold uppercase tracking-widest">
            Premium Automotive Parts Manufacturer
          </span>
        </div>

        {/* Headline with 3D text depth */}
        <div
          className={`transition-all duration-1000 delay-200 ${
            isVisible ? "opacity-100 translate-y-0" : "opacity-0 translate-y-8"
          }`}
          style={{ perspective: "600px" }}
        >
          <h1
            className="text-5xl md:text-7xl lg:text-8xl font-black tracking-tighter leading-[0.95] mb-6"
            style={{
              textShadow: "0 2px 0 rgba(220,38,38,0.08), 0 4px 0 rgba(0,0,0,0.2), 0 8px 20px rgba(0,0,0,0.5)",
            }}
          >
            <span
              className="block text-white"
              style={{ textShadow: "0 1px 0 #ccc, 0 2px 0 #aaa, 0 3px 0 #888, 0 8px 16px rgba(0,0,0,0.7)" }}
            >
              {headlines[currentHeadline][0]}
            </span>
            <span className="block text-gradient-red">
              {headlines[currentHeadline][1]}
            </span>
          </h1>
        </div>

        {/* Subheadline */}
        <p
          className={`text-[var(--text-secondary)] text-lg md:text-xl max-w-2xl mx-auto mb-12 leading-relaxed transition-all duration-1000 delay-400 ${
            isVisible ? "opacity-100 translate-y-0" : "opacity-0 translate-y-8"
          }`}
        >
          OEM-compatible spare parts for two-wheelers, manufactured with precision
          engineering and tested to the highest standards.
        </p>

        {/* CTAs */}
        <div
          className={`flex flex-col sm:flex-row items-center justify-center gap-4 transition-all duration-1000 delay-500 ${
            isVisible ? "opacity-100 translate-y-0" : "opacity-0 translate-y-8"
          }`}
        >
          <Link
            href="/become-dealer"
            className="group flex items-center gap-2.5 bg-red-600 hover:bg-red-700 text-white font-bold px-8 py-4 rounded-xl transition-all duration-200 text-sm uppercase tracking-wider"
            style={{ boxShadow: "0 0 32px rgba(220,38,38,0.45), 0 4px 20px rgba(0,0,0,0.4), inset 0 1px 0 rgba(255,255,255,0.15)" }}
          >
            Become a Dealer
            <ArrowRight size={16} className="group-hover:translate-x-1 transition-transform" />
          </Link>
          <Link
            href="/products"
            className="group flex items-center gap-2.5 border border-white/20 hover:border-red-600/50 text-white font-bold px-8 py-4 rounded-xl transition-all duration-200 text-sm uppercase tracking-wider"
            style={{ background: "rgba(255,255,255,0.06)", backdropFilter: "blur(10px)" }}
          >
            Explore Products
            <ArrowRight size={16} className="opacity-0 group-hover:opacity-100 group-hover:translate-x-1 transition-all" />
          </Link>
        </div>

        {/* Stats — 3D floating cards */}
        <div
          className={`mt-20 flex flex-row items-stretch justify-center gap-4 max-w-lg mx-auto transition-all duration-1000 delay-700 ${
            isVisible ? "opacity-100 translate-y-0" : "opacity-0 translate-y-8"
          }`}
        >
          {[
            { value: `${productCount}+`, label: "Products" },
            { value: `${categoryCount}+`, label: "Categories" },
            { value: "10K+", label: "Units / Month" },
          ].map((stat, i) => (
            <div
              key={stat.label}
              className="flex-1 rounded-xl px-4 py-3 text-center"
              style={{
                background: "rgba(255,255,255,0.04)",
                border: "1px solid rgba(255,255,255,0.08)",
                backdropFilter: "blur(12px)",
                boxShadow: "0 8px 32px rgba(0,0,0,0.3), inset 0 1px 0 rgba(255,255,255,0.06)",
              }}
            >
              <div className="text-3xl md:text-4xl font-black text-white mb-1"
                style={{ textShadow: "0 0 20px rgba(220,38,38,0.4)" }}
              >
                {stat.value}
              </div>
              <div className="text-[var(--text-muted)] text-[10px] uppercase tracking-widest">{stat.label}</div>
            </div>
          ))}
        </div>
      </div>

      {/* Scroll indicator */}
      <div className="absolute bottom-8 left-1/2 -translate-x-1/2 flex flex-col items-center gap-2 animate-bounce z-10">
        <span className="text-[var(--text-muted)] text-[10px] uppercase tracking-widest">Scroll</span>
        <ChevronDown size={14} className="text-red-600" />
      </div>

      {/* Headline dots */}
      <div className="absolute bottom-8 right-8 flex gap-2 items-center z-10">
        {headlines.map((_, i) => (
          <button
            key={i}
            onClick={() => setCurrentHeadline(i)}
            className={`h-[2px] transition-all duration-300 rounded-full ${
              i === currentHeadline ? "w-8 bg-red-600" : "w-3 bg-white/20"
            }`}
          />
        ))}
      </div>
    </section>
  );
}
