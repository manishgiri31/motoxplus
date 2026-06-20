"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import { ArrowRight, ChevronDown } from "lucide-react";

const headlines: [string, string][] = [
  ["Engineered For", "Reliability."],
  ["Built For", "Every Journey."],
  ["Performance", "You Can Trust."],
];

export function HeroSection() {
  const [currentHeadline, setCurrentHeadline] = useState(0);
  const [isVisible, setIsVisible] = useState(false);

  useEffect(() => {
    setIsVisible(true);
    const interval = setInterval(() => {
      setCurrentHeadline((prev) => (prev + 1) % headlines.length);
    }, 4000);
    return () => clearInterval(interval);
  }, []);

  return (
    <section className="relative min-h-screen flex flex-col items-center justify-center overflow-hidden">
      {/* Background */}
      <div className="absolute inset-0">
        <div className="absolute inset-0 bg-gradient-to-b from-black via-[#060000] to-[#080808] dark:opacity-100 opacity-0 transition-opacity duration-300" />
        <div className="absolute inset-0 bg-gradient-to-b from-gray-100 via-white to-gray-50 dark:opacity-0 opacity-100 transition-opacity duration-300" />

        {/* Red atmospheric glow */}
        <div className="absolute top-1/3 left-1/2 -translate-x-1/2 -translate-y-1/2 w-[900px] h-[550px] bg-red-900/15 rounded-full blur-[140px]" />
        <div className="absolute bottom-0 right-0 w-[500px] h-[500px] bg-red-950/20 rounded-full blur-[100px] dark:opacity-100 opacity-30" />
        <div className="absolute top-0 left-0 w-[300px] h-[400px] bg-red-950/10 rounded-full blur-[80px] dark:opacity-100 opacity-20" />

        {/* Subtle grid */}
        <div
          className="absolute inset-0 dark:opacity-[0.025] opacity-[0.05]"
          style={{
            backgroundImage:
              "linear-gradient(rgba(0,0,0,0.2) 1px, transparent 1px), linear-gradient(90deg, rgba(0,0,0,0.2) 1px, transparent 1px)",
            backgroundSize: "64px 64px",
          }}
        />
        {/* Accent stripe */}
        <div className="absolute top-0 left-0 w-[2px] h-full bg-gradient-to-b from-red-600 via-red-800/40 to-transparent" />
        <div className="absolute top-0 right-0 w-[1px] h-2/3 bg-gradient-to-b from-transparent via-red-900/20 to-transparent" />
      </div>

      {/* Content */}
      <div className="relative z-10 max-w-7xl mx-auto px-4 md:px-8 text-center">
        {/* Badge */}
        <div
          className={`inline-flex items-center gap-2.5 glass border border-red-900/40 rounded-full px-5 py-2 mb-10 transition-all duration-1000 ${
            isVisible ? "opacity-100 translate-y-0" : "opacity-0 translate-y-4"
          }`}
        >
          <div className="w-2 h-2 bg-red-500 rounded-full animate-pulse" />
          <span className="text-red-400 text-xs font-semibold uppercase tracking-widest">
            Premium Automotive Parts Manufacturer
          </span>
        </div>

        {/* Headline */}
        <div
          className={`transition-all duration-1000 delay-200 ${
            isVisible ? "opacity-100 translate-y-0" : "opacity-0 translate-y-8"
          }`}
        >
          <h1 className="text-5xl md:text-7xl lg:text-8xl font-black tracking-tighter leading-[0.95] mb-6">
            <span className="block text-[var(--text-primary)]">
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
            className="group flex items-center gap-2.5 bg-red-600 hover:bg-red-700 text-white font-bold px-8 py-4 rounded-xl transition-all duration-200 red-glow text-sm uppercase tracking-wider"
          >
            Become a Dealer
            <ArrowRight size={16} className="group-hover:translate-x-1 transition-transform" />
          </Link>
          <Link
            href="/products"
            className="group flex items-center gap-2.5 glass border border-[var(--border-color)] hover:border-red-600/50 text-[var(--text-primary)] font-bold px-8 py-4 rounded-xl transition-all duration-200 text-sm uppercase tracking-wider"
          >
            Explore Products
            <ArrowRight size={16} className="opacity-0 group-hover:opacity-100 group-hover:translate-x-1 transition-all" />
          </Link>
        </div>

        {/* Stats */}
        <div
          className={`mt-20 flex flex-row items-center justify-center max-w-lg mx-auto transition-all duration-1000 delay-700 ${
            isVisible ? "opacity-100 translate-y-0" : "opacity-0 translate-y-8"
          }`}
        >
          {[
            { value: "500+", label: "Products" },
            { value: "18+", label: "States Served" },
            { value: "10K+", label: "Units / Month" },
          ].map((stat, i) => (
            <div key={stat.label} className="flex items-center flex-1">
              <div className="text-center flex-1">
                <div className="text-3xl md:text-4xl font-black text-[var(--text-primary)] mb-1">{stat.value}</div>
                <div className="text-[var(--text-muted)] text-[10px] uppercase tracking-widest">{stat.label}</div>
              </div>
              {i < 2 && <div className="w-px h-10 bg-[var(--border-color)]" />}
            </div>
          ))}
        </div>
      </div>

      {/* Scroll indicator */}
      <div className="absolute bottom-8 left-1/2 -translate-x-1/2 flex flex-col items-center gap-2 animate-bounce">
        <span className="text-[var(--text-muted)] text-[10px] uppercase tracking-widest">Scroll</span>
        <ChevronDown size={14} className="text-red-600" />
      </div>

      {/* Headline dots */}
      <div className="absolute bottom-8 right-8 flex gap-2 items-center">
        {headlines.map((_, i) => (
          <button
            key={i}
            onClick={() => setCurrentHeadline(i)}
            className={`h-[2px] transition-all duration-300 rounded-full ${
              i === currentHeadline ? "w-8 bg-red-600" : "w-3 bg-[var(--text-muted)]/50"
            }`}
          />
        ))}
      </div>
    </section>
  );
}
