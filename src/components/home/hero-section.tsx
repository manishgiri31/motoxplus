"use client";

import { useEffect, useState, useCallback, useRef } from "react";
import Link from "next/link";
import { ArrowRight, ChevronDown, ChevronLeft, ChevronRightIcon } from "lucide-react";
import { AnimatePresence, motion } from "framer-motion";

interface Slide {
  eyebrow: string;
  headline: [string, string];
  copy: string;
  accent: string; // gradient stops for the background mesh
}

const slides: Slide[] = [
  {
    eyebrow: "Premium Automotive Parts Manufacturer",
    headline: ["Engineered For", "Reliability."],
    copy: "OEM-compatible spare parts for two-wheelers, manufactured with precision engineering and tested to the highest standards.",
    accent: "from-red-600/30 via-red-900/10 to-transparent",
  },
  {
    eyebrow: "500+ Dealers Across 18+ States",
    headline: ["Built For", "Every Journey."],
    copy: "A nationwide dealer and distribution network built to get the right part to the right workshop, fast.",
    accent: "from-zinc-500/25 via-red-900/10 to-transparent",
  },
  {
    eyebrow: "ISO-Certified Manufacturing",
    headline: ["Performance", "You Can Trust."],
    copy: "Six-stage manufacturing and multi-point quality inspection behind every component that leaves our facility.",
    accent: "from-red-500/25 via-zinc-800/10 to-transparent",
  },
];

interface Props {
  productCount?: number;
  categoryCount?: number;
}

export function HeroSection({ productCount = 700, categoryCount = 15 }: Props) {
  const [active, setActive] = useState(0);
  const [isVisible, setIsVisible] = useState(false);
  const [paused, setPaused] = useState(false);
  const timerRef = useRef<ReturnType<typeof setInterval> | null>(null);

  useEffect(() => setIsVisible(true), []);

  useEffect(() => {
    if (paused) return;
    timerRef.current = setInterval(() => {
      setActive((prev) => (prev + 1) % slides.length);
    }, 6000);
    return () => {
      if (timerRef.current) clearInterval(timerRef.current);
    };
  }, [paused]);

  const goTo = useCallback((i: number) => {
    setActive(((i % slides.length) + slides.length) % slides.length);
  }, []);

  const slide = slides[active];

  return (
    <section
      className="relative min-h-screen flex flex-col items-center justify-center overflow-hidden bg-[var(--bg-primary)] pt-24 md:pt-32"
      onMouseEnter={() => setPaused(true)}
      onMouseLeave={() => setPaused(false)}
    >
      {/* Background layer — crossfades + slow Ken-Burns zoom per slide */}
      <div className="absolute inset-0 z-0">
        <AnimatePresence mode="sync">
          <motion.div
            key={active}
            initial={{ opacity: 0, scale: 1.08 }}
            animate={{ opacity: 1, scale: 1 }}
            exit={{ opacity: 0 }}
            transition={{ opacity: { duration: 1.1, ease: "easeInOut" }, scale: { duration: 6, ease: "linear" } }}
            className={`absolute inset-0 bg-gradient-to-br ${slide.accent}`}
          />
        </AnimatePresence>

        {/* Dot grid pattern */}
        <div
          className="absolute inset-0 opacity-[0.055] dark:opacity-[0.08]"
          style={{
            backgroundImage: `radial-gradient(circle, var(--text-muted) 1px, transparent 1px)`,
            backgroundSize: "32px 32px",
          }}
        />
        {/* Red glow blob top-right */}
        <div className="absolute -top-32 -right-32 w-[700px] h-[700px] bg-red-500/10 rounded-full blur-[120px]" />
        {/* Soft accent bottom-left */}
        <div className="absolute -bottom-20 -left-20 w-[500px] h-[500px] bg-[var(--bg-secondary)] rounded-full blur-[100px]" />
        {/* Bottom fade */}
        <div className="absolute bottom-0 left-0 right-0 h-40 bg-gradient-to-t from-[var(--bg-primary)]/80 to-transparent" />
      </div>

      {/* Decorative vertical lines */}
      <div className="absolute left-8 md:left-16 top-1/2 -translate-y-1/2 hidden lg:flex flex-col gap-2 opacity-15">
        {[...Array(8)].map((_, i) => (
          <div
            key={i}
            className="w-px bg-[var(--text-muted)] rounded-full"
            style={{ height: `${12 + i * 4}px` }}
          />
        ))}
      </div>

      {/* Prev/Next arrows */}
      <button
        onClick={() => goTo(active - 1)}
        aria-label="Previous slide"
        className="hidden md:flex absolute left-6 top-1/2 -translate-y-1/2 z-20 w-11 h-11 items-center justify-center rounded-full glass border border-[var(--border-color)] text-[var(--text-muted)] hover:text-red-500 hover:border-red-500/40 transition-all"
      >
        <ChevronLeft size={18} />
      </button>
      <button
        onClick={() => goTo(active + 1)}
        aria-label="Next slide"
        className="hidden md:flex absolute right-6 top-1/2 -translate-y-1/2 z-20 w-11 h-11 items-center justify-center rounded-full glass border border-[var(--border-color)] text-[var(--text-muted)] hover:text-red-500 hover:border-red-500/40 transition-all"
      >
        <ChevronRightIcon size={18} />
      </button>

      {/* Content */}
      <div className="relative z-10 max-w-7xl mx-auto px-4 md:px-8 text-center">
        {/* Badge */}
        <div
          className={`inline-flex items-center gap-2.5 border border-red-500/20 bg-red-500/10 rounded-full px-5 py-2 mb-10 transition-all duration-1000 ${
            isVisible ? "opacity-100 translate-y-0" : "opacity-0 translate-y-4"
          }`}
        >
          <div className="w-2 h-2 bg-red-500 rounded-full animate-pulse" />
          <AnimatePresence mode="wait">
            <motion.span
              key={active}
              initial={{ opacity: 0, y: 4 }}
              animate={{ opacity: 1, y: 0 }}
              exit={{ opacity: 0, y: -4 }}
              transition={{ duration: 0.3 }}
              className="text-red-600 text-xs font-semibold uppercase tracking-widest"
            >
              {slide.eyebrow}
            </motion.span>
          </AnimatePresence>
        </div>

        {/* Headline */}
        <div
          className={`transition-all duration-1000 delay-200 ${
            isVisible ? "opacity-100 translate-y-0" : "opacity-0 translate-y-8"
          }`}
        >
          <h1 className="text-5xl md:text-7xl lg:text-8xl font-black tracking-tighter leading-[0.95] mb-6 min-h-[2.1em] md:min-h-[1.9em]">
            <AnimatePresence mode="wait">
              <motion.span
                key={active}
                initial={{ opacity: 0, y: 24 }}
                animate={{ opacity: 1, y: 0 }}
                exit={{ opacity: 0, y: -24 }}
                transition={{ duration: 0.5, ease: [0.16, 1, 0.3, 1] }}
                className="block"
              >
                <span className="block text-[var(--text-primary)]">{slide.headline[0]}</span>
                <span className="block text-gradient-red">{slide.headline[1]}</span>
              </motion.span>
            </AnimatePresence>
          </h1>
        </div>

        {/* Subheadline */}
        <div
          className={`min-h-[3.5em] md:min-h-[2.5em] max-w-2xl mx-auto mb-12 transition-all duration-1000 delay-400 ${
            isVisible ? "opacity-100 translate-y-0" : "opacity-0 translate-y-8"
          }`}
        >
          <AnimatePresence mode="wait">
            <motion.p
              key={active}
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              exit={{ opacity: 0 }}
              transition={{ duration: 0.4, delay: 0.1 }}
              className="text-[var(--text-muted)] text-lg md:text-xl leading-relaxed"
            >
              {slide.copy}
            </motion.p>
          </AnimatePresence>
        </div>

        {/* CTAs */}
        <div
          className={`flex flex-col sm:flex-row items-center justify-center gap-4 transition-all duration-1000 delay-500 ${
            isVisible ? "opacity-100 translate-y-0" : "opacity-0 translate-y-8"
          }`}
        >
          <Link
            href="/become-dealer"
            className="group flex items-center gap-2.5 bg-red-600 hover:bg-red-700 text-white font-bold px-8 py-4 rounded-xl transition-all duration-200 text-sm uppercase tracking-wider shadow-xl shadow-red-600/25"
          >
            Become a Dealer
            <ArrowRight size={16} className="group-hover:translate-x-1 transition-transform" />
          </Link>
          <Link
            href="/products"
            className="group flex items-center gap-2.5 border-2 border-[var(--border-color)] hover:border-red-300 text-[var(--text-secondary)] hover:text-red-600 font-bold px-8 py-4 rounded-xl transition-all duration-200 text-sm uppercase tracking-wider bg-[var(--bg-secondary)] hover:bg-red-500/10"
          >
            Explore Products
            <ArrowRight size={16} className="opacity-0 group-hover:opacity-100 group-hover:translate-x-1 transition-all" />
          </Link>
        </div>

        {/* Stats */}
        <div
          className={`mt-20 flex flex-row items-stretch justify-center gap-4 max-w-lg mx-auto transition-all duration-1000 delay-700 ${
            isVisible ? "opacity-100 translate-y-0" : "opacity-0 translate-y-8"
          }`}
        >
          {[
            { value: `${productCount}+`, label: "Products" },
            { value: `${categoryCount}+`, label: "Categories" },
            { value: "10K+", label: "Units / Month" },
          ].map((stat) => (
            <div
              key={stat.label}
              className="flex-1 rounded-xl px-4 py-4 text-center glass border border-[var(--border-color)] shadow-sm hover:shadow-md hover:border-red-900/30 transition-all duration-200"
            >
              <div className="text-3xl md:text-4xl font-black text-[var(--text-primary)] mb-1">
                {stat.value}
              </div>
              <div className="text-[var(--text-muted)] text-[10px] uppercase tracking-widest">{stat.label}</div>
            </div>
          ))}
        </div>

        {/* Scroll indicator */}
        <div className="mt-12 flex flex-col items-center gap-2 animate-bounce">
          <span className="text-[var(--text-muted)] text-[10px] uppercase tracking-widest">Scroll</span>
          <ChevronDown size={14} className="text-red-500" />
        </div>
      </div>

      {/* Slide indicators */}
      <div className="absolute bottom-8 right-8 hidden lg:flex gap-2 items-center z-20">
        {slides.map((_, i) => (
          <button
            key={i}
            onClick={() => goTo(i)}
            aria-label={`Go to slide ${i + 1}`}
            className={`h-[3px] transition-all duration-300 rounded-full ${
              i === active ? "w-8 bg-red-600" : "w-3 bg-[var(--border-color)] hover:bg-red-600/40"
            }`}
          />
        ))}
      </div>
    </section>
  );
}
