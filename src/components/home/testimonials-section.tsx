"use client";

import { Star, Quote } from "lucide-react";
import { TiltCard } from "@/components/3d/tilt-card";
import { Reveal, RevealGroup, RevealItem } from "@/components/ui/reveal";

const testimonials = [
  {
    quote:
      "Fitment accuracy has been consistent across every batch we've ordered. Our workshop customers rarely come back with compatibility complaints.",
    name: "Dealer Partner",
    role: "Multi-brand parts distributor, North India",
  },
  {
    quote:
      "Order turnaround and the online portal make reordering fast stock a five-minute job instead of a phone-call chase.",
    name: "Dealer Partner",
    role: "Two-wheeler spares retailer, West India",
  },
  {
    quote:
      "What sold us was the quality documentation — every batch comes with test data we can show our own customers.",
    name: "Dealer Partner",
    role: "Workshop supply chain, South India",
  },
];

export function TestimonialsSection() {
  return (
    <section className="py-24 px-4 md:px-8 bg-[var(--bg-primary)]">
      <div className="max-w-7xl mx-auto">
        <Reveal className="text-center mb-16">
          <div className="flex items-center justify-center gap-3 mb-4">
            <div className="w-8 h-px bg-red-600" />
            <span className="text-red-500 text-xs font-semibold uppercase tracking-widest">
              Trusted Nationwide
            </span>
            <div className="w-8 h-px bg-red-600" />
          </div>
          <h2 className="text-4xl md:text-5xl font-black text-[var(--text-primary)] tracking-tight">
            What Our Dealers <span className="text-gradient-red">Say.</span>
          </h2>
        </Reveal>

        <RevealGroup className="grid grid-cols-1 md:grid-cols-3 gap-5">
          {testimonials.map((t, i) => (
            <RevealItem key={i}>
            <TiltCard intensity={6}>
              <div className="relative h-full glass border border-[var(--border-color)] rounded-2xl p-7 flex flex-col hover:border-red-900/30 transition-colors duration-300">
                <Quote size={28} className="text-red-500/25 mb-4" />
                <div className="flex gap-0.5 mb-4">
                  {Array.from({ length: 5 }).map((_, s) => (
                    <Star key={s} size={13} className="fill-red-500 text-red-500" />
                  ))}
                </div>
                <p className="text-[var(--text-secondary)] text-sm leading-relaxed flex-1 mb-6">
                  &ldquo;{t.quote}&rdquo;
                </p>
                <div className="pt-4 border-t border-[var(--border-color)]">
                  <div className="text-[var(--text-primary)] font-bold text-sm">{t.name}</div>
                  <div className="text-[var(--text-muted)] text-xs mt-0.5">{t.role}</div>
                </div>
              </div>
            </TiltCard>
            </RevealItem>
          ))}
        </RevealGroup>
      </div>
    </section>
  );
}
