"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import { ArrowRight, ChevronDown } from "lucide-react";

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

  useEffect(() => {
    setIsVisible(true);
    const interval = setInterval(() => {
      setCurrentHeadline((prev) => (prev + 1) % headlines.length);
    }, 4000);
    return () => clearInterval(interval);
  }, []);

  return (
    <section className="relative min-h-screen flex flex-col items-center justify-center overflow-hidden bg-white">
      {/* Background */}
      <div className="absolute inset-0 z-0">
        {/* Dot grid pattern */}
        <div
          className="absolute inset-0 opacity-[0.055]"
          style={{
            backgroundImage: `radial-gradient(circle, #000 1px, transparent 1px)`,
            backgroundSize: "32px 32px",
          }}
        />
        {/* Red glow blob top-right */}
        <div className="absolute -top-32 -right-32 w-[700px] h-[700px] bg-red-100/60 rounded-full blur-[120px]" />
        {/* Soft accent bottom-left */}
        <div className="absolute -bottom-20 -left-20 w-[500px] h-[500px] bg-slate-100 rounded-full blur-[100px]" />
        {/* Bottom fade */}
        <div className="absolute bottom-0 left-0 right-0 h-40 bg-gradient-to-t from-gray-50/80 to-transparent" />
      </div>

      {/* Decorative vertical lines */}
      <div className="absolute left-8 md:left-16 top-1/2 -translate-y-1/2 hidden lg:flex flex-col gap-2 opacity-15">
        {[...Array(8)].map((_, i) => (
          <div
            key={i}
            className="w-px bg-gray-500 rounded-full"
            style={{ height: `${12 + i * 4}px` }}
          />
        ))}
      </div>

      {/* Content */}
      <div className="relative z-10 max-w-7xl mx-auto px-4 md:px-8 text-center">
        {/* Badge */}
        <div
          className={`inline-flex items-center gap-2.5 border border-red-200 bg-red-50 rounded-full px-5 py-2 mb-10 transition-all duration-1000 ${
            isVisible ? "opacity-100 translate-y-0" : "opacity-0 translate-y-4"
          }`}
        >
          <div className="w-2 h-2 bg-red-500 rounded-full animate-pulse" />
          <span className="text-red-600 text-xs font-semibold uppercase tracking-widest">
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
            <span className="block text-gray-900">
              {headlines[currentHeadline][0]}
            </span>
            <span className="block text-gradient-red">
              {headlines[currentHeadline][1]}
            </span>
          </h1>
        </div>

        {/* Subheadline */}
        <p
          className={`text-gray-500 text-lg md:text-xl max-w-2xl mx-auto mb-12 leading-relaxed transition-all duration-1000 delay-400 ${
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
            className="group flex items-center gap-2.5 bg-red-600 hover:bg-red-700 text-white font-bold px-8 py-4 rounded-xl transition-all duration-200 text-sm uppercase tracking-wider shadow-xl shadow-red-600/25"
          >
            Become a Dealer
            <ArrowRight size={16} className="group-hover:translate-x-1 transition-transform" />
          </Link>
          <Link
            href="/products"
            className="group flex items-center gap-2.5 border-2 border-gray-200 hover:border-red-300 text-gray-700 hover:text-red-600 font-bold px-8 py-4 rounded-xl transition-all duration-200 text-sm uppercase tracking-wider bg-white hover:bg-red-50"
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
              className="flex-1 rounded-xl px-4 py-4 text-center bg-white border border-gray-100 shadow-sm hover:shadow-md hover:border-red-100 transition-all duration-200"
            >
              <div className="text-3xl md:text-4xl font-black text-gray-900 mb-1">
                {stat.value}
              </div>
              <div className="text-gray-400 text-[10px] uppercase tracking-widest">{stat.label}</div>
            </div>
          ))}
        </div>
      </div>

      {/* Scroll indicator */}
      <div className="absolute bottom-8 left-1/2 -translate-x-1/2 flex flex-col items-center gap-2 animate-bounce z-10">
        <span className="text-gray-400 text-[10px] uppercase tracking-widest">Scroll</span>
        <ChevronDown size={14} className="text-red-500" />
      </div>

      {/* Headline dots */}
      <div className="absolute bottom-8 right-8 flex gap-2 items-center z-10">
        {headlines.map((_, i) => (
          <button
            key={i}
            onClick={() => setCurrentHeadline(i)}
            className={`h-[2px] transition-all duration-300 rounded-full ${
              i === currentHeadline ? "w-8 bg-red-600" : "w-3 bg-gray-300"
            }`}
          />
        ))}
      </div>
    </section>
  );
}
