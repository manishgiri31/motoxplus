"use client";

import Link from "next/link";
import { ArrowRight, CheckCircle2 } from "lucide-react";

const benefits = [
  "Exclusive dealer pricing and margin protection",
  "Priority stock allocation and fulfillment",
  "Dedicated dealer support team",
  "Marketing materials and point-of-sale support",
  "GST-compliant invoice generation",
  "Online order management portal",
  "Net-30 credit terms for approved dealers",
  "Regional training and product workshops",
];

const dealerStats = [
  { value: "500+", label: "Active Dealers", highlight: true },
  { value: "18", label: "States Covered", highlight: false },
  { value: "48h", label: "Avg. Delivery Time", highlight: true },
  { value: "98%", label: "Order Fulfilment Rate", highlight: false },
  { value: "4.8★", label: "Dealer Satisfaction", highlight: true },
];

export function DealerProgram() {
  return (
    <section className="py-24 px-4 md:px-8 bg-[var(--bg-secondary)] relative overflow-hidden">
      {/* Background */}
      <div className="absolute inset-0">
        <div className="absolute top-0 left-0 right-0 h-px bg-gradient-to-r from-transparent via-red-900/40 to-transparent" />
        <div className="absolute bottom-0 left-0 right-0 h-px bg-gradient-to-r from-transparent via-red-900/25 to-transparent" />
        <div className="absolute top-1/2 left-1/2 -translate-x-1/2 -translate-y-1/2 w-[700px] h-[700px] bg-red-950/8 rounded-full blur-[130px]" />
      </div>

      <div className="max-w-7xl mx-auto relative z-10">
        <div className="grid grid-cols-1 lg:grid-cols-2 gap-16 items-center">
          {/* Left */}
          <div>
            <div className="flex items-center gap-3 mb-6">
              <div className="w-8 h-px bg-red-600" />
              <span className="text-red-500 text-xs font-semibold uppercase tracking-widest">
                Dealer Program
              </span>
            </div>
            <h2 className="text-4xl md:text-5xl font-black text-[var(--text-primary)] tracking-tight mb-6">
              Grow Your Business<br />
              <span className="text-gradient-red">With MOTOXPLUS.</span>
            </h2>
            <p className="text-[var(--text-muted)] text-lg leading-relaxed mb-8">
              Join our network of 500+ dealers across India. Get access to
              premium products, competitive pricing, and the tools you need
              to serve your customers better.
            </p>

            <ul className="grid grid-cols-1 gap-2.5 mb-10">
              {benefits.map((benefit) => (
                <li key={benefit} className="flex items-center gap-3 py-1">
                  <CheckCircle2 size={16} className="text-red-500 flex-shrink-0" />
                  <span className="text-[var(--text-secondary)] text-sm">{benefit}</span>
                </li>
              ))}
            </ul>

            <Link
              href="/become-dealer"
              className="group inline-flex items-center gap-2.5 bg-red-600 hover:bg-red-700 text-white font-bold px-8 py-4 rounded-xl transition-all duration-200 red-glow text-sm uppercase tracking-wider"
            >
              Apply Now — It&apos;s Free
              <ArrowRight size={16} className="group-hover:translate-x-1 transition-transform" />
            </Link>
          </div>

          {/* Right — Stats card */}
          <div className="relative">
            <div className="glass border border-[var(--border-color)] rounded-2xl p-8 relative overflow-hidden">
              <div className="absolute top-0 right-0 w-40 h-40 bg-red-900/10 rounded-full blur-[60px] pointer-events-none" />

              <h3 className="text-[var(--text-primary)] font-bold text-lg mb-8 uppercase tracking-wider relative z-10">
                Dealer Network Stats
              </h3>

              <div className="relative z-10 space-y-0">
                {dealerStats.map((stat, i) => (
                  <div
                    key={stat.label}
                    className={`flex items-center justify-between py-4 ${i < dealerStats.length - 1 ? "border-b border-[var(--border-color)]" : ""}`}
                  >
                    <span className="text-[var(--text-muted)] text-sm">{stat.label}</span>
                    <span className={`font-black text-2xl ${stat.highlight ? "text-red-500" : "text-[var(--text-primary)]"}`}>
                      {stat.value}
                    </span>
                  </div>
                ))}
              </div>
            </div>

            {/* Decorative corners */}
            <div className="absolute -top-3 -right-3 w-20 h-20 border-t-2 border-r-2 border-red-600/35 rounded-tr-lg" />
            <div className="absolute -bottom-3 -left-3 w-20 h-20 border-b-2 border-l-2 border-red-600/25 rounded-bl-lg" />
          </div>
        </div>
      </div>
    </section>
  );
}
