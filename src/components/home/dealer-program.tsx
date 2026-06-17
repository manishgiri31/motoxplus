"use client";

import Link from "next/link";
import { ArrowRight, CheckCircle } from "lucide-react";

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

export function DealerProgram() {
  return (
    <section className="py-24 px-4 md:px-8 bg-[var(--bg-secondary)] relative overflow-hidden">
      {/* Background */}
      <div className="absolute inset-0">
        <div className="absolute top-0 left-0 right-0 h-px bg-gradient-to-r from-transparent via-red-900/50 to-transparent" />
        <div className="absolute bottom-0 left-0 right-0 h-px bg-gradient-to-r from-transparent via-red-900/30 to-transparent" />
        <div className="absolute top-1/2 left-1/2 -translate-x-1/2 -translate-y-1/2 w-[600px] h-[600px] bg-red-950/10 rounded-full blur-[120px]" />
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

            <ul className="grid grid-cols-1 gap-3 mb-10">
              {benefits.map((benefit) => (
                <li key={benefit} className="flex items-center gap-3">
                  <CheckCircle size={16} className="text-red-500 flex-shrink-0" />
                  <span className="text-[var(--text-secondary)] text-sm">{benefit}</span>
                </li>
              ))}
            </ul>

            <Link
              href="/become-dealer"
              className="group inline-flex items-center gap-2 bg-red-600 hover:bg-red-700 text-white font-bold px-8 py-4 rounded-sm transition-all duration-200 red-glow text-sm uppercase tracking-wider"
            >
              Apply Now — It&apos;s Free
              <ArrowRight size={16} className="group-hover:translate-x-1 transition-transform" />
            </Link>
          </div>

          {/* Right — Stats card */}
          <div className="relative">
            <div className="glass border border-white/8 rounded-sm p-8">
              <h3 className="text-[var(--text-primary)] font-bold text-xl mb-8 uppercase tracking-wider">
                Dealer Network Stats
              </h3>

              {[
                { value: "500+", label: "Active Dealers", color: "text-red-500" },
                { value: "18", label: "States Covered", color: "text-[var(--text-primary)]" },
                { value: "48h", label: "Avg. Delivery Time", color: "text-red-500" },
                { value: "98%", label: "Order Fulfilment Rate", color: "text-[var(--text-primary)]" },
                { value: "4.8★", label: "Dealer Satisfaction", color: "text-red-500" },
              ].map((stat) => (
                <div
                  key={stat.label}
                  className="flex items-center justify-between py-4 border-b border-[var(--border-color)] last:border-0"
                >
                  <span className="text-[var(--text-muted)] text-sm">{stat.label}</span>
                  <span className={`font-black text-2xl ${stat.color}`}>{stat.value}</span>
                </div>
              ))}
            </div>

            {/* Decorative corner */}
            <div className="absolute -top-4 -right-4 w-24 h-24 border-t-2 border-r-2 border-red-600/30" />
            <div className="absolute -bottom-4 -left-4 w-24 h-24 border-b-2 border-l-2 border-red-600/20" />
          </div>
        </div>
      </div>
    </section>
  );
}
