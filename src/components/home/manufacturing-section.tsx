"use client";

import Link from "next/link";
import { TiltCard } from "@/components/3d/tilt-card";
import { Reveal, RevealGroup, RevealItem } from "@/components/ui/reveal";

const processes = [
  {
    step: "01",
    title: "Raw Material Selection",
    description: "Only certified-grade alloys and composites meeting automotive standards.",
  },
  {
    step: "02",
    title: "Precision Manufacturing",
    description: "CNC machining and automated production lines for consistent dimensional accuracy.",
  },
  {
    step: "03",
    title: "Quality Inspection",
    description: "Multi-point inspection at every stage with CMM and non-destructive testing.",
  },
  {
    step: "04",
    title: "Surface Treatment",
    description: "Advanced coating and plating processes for corrosion and wear resistance.",
  },
  {
    step: "05",
    title: "Performance Testing",
    description: "Load, fatigue, and thermal testing to validate real-world performance.",
  },
  {
    step: "06",
    title: "Premium Packaging",
    description: "Secure, branded packaging that protects parts during transit.",
  },
];

export function ManufacturingSection() {
  return (
    <section className="py-24 px-4 md:px-8 bg-[var(--bg-primary)]">
      <div className="max-w-7xl mx-auto">
        {/* Header */}
        <Reveal className="text-center mb-16">
          <div className="flex items-center justify-center gap-3 mb-4">
            <div className="w-8 h-px bg-red-600" />
            <span className="text-red-500 text-xs font-semibold uppercase tracking-widest">
              Manufacturing Excellence
            </span>
            <div className="w-8 h-px bg-red-600" />
          </div>
          <h2 className="text-4xl md:text-5xl font-black text-[var(--text-primary)] tracking-tight mb-4">
            From Raw Metal to<br />
            <span className="text-gradient-red">Precision Part.</span>
          </h2>
          <p className="text-[var(--text-muted)] max-w-xl mx-auto leading-relaxed">
            Our six-stage manufacturing process ensures every component that leaves
            our facility is built to perform.
          </p>
        </Reveal>

        {/* Process grid */}
        <RevealGroup className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
          {processes.map((process) => (
            <RevealItem key={process.step}>
            <TiltCard intensity={9}>
            <div
              className="group relative glass border border-[var(--border-color)] hover:border-red-900/45 rounded-2xl p-7 transition-all duration-300 overflow-hidden"
            >
              {/* Step number watermark */}
              <div className="absolute top-3 right-4 text-7xl font-black text-[var(--text-primary)]/[0.04] group-hover:text-red-900/15 transition-colors leading-none select-none pointer-events-none">
                {process.step}
              </div>

              {/* Content */}
              <div className="relative z-10">
                <div className="flex items-center gap-3 mb-5">
                  <div className="w-7 h-7 rounded-lg bg-red-600/15 border border-red-900/30 flex items-center justify-center">
                    <span className="text-red-500 text-[10px] font-black">{process.step}</span>
                  </div>
                  <div className="w-6 h-px bg-red-600/50" />
                </div>
                <h3 className="text-[var(--text-primary)] font-bold text-base mb-2.5">{process.title}</h3>
                <p className="text-[var(--text-muted)] text-sm leading-relaxed">{process.description}</p>
              </div>

              {/* Bottom sweep */}
              <div className="absolute bottom-0 left-0 h-[2px] w-0 group-hover:w-full bg-gradient-to-r from-red-600 to-transparent transition-all duration-500 rounded-b-2xl" />
            </div>
            </TiltCard>
            </RevealItem>
          ))}
        </RevealGroup>

        {/* Bottom CTA */}
        <Reveal className="mt-16 glass border border-[var(--border-color)] rounded-2xl p-8 md:p-12 flex flex-col md:flex-row items-center justify-between gap-8 relative overflow-hidden">
          <div className="absolute top-0 right-0 w-64 h-64 bg-red-500/10 rounded-full blur-[80px] pointer-events-none" />
          <div className="relative z-10">
            <h3 className="text-2xl md:text-3xl font-black text-[var(--text-primary)] mb-2">
              Interested in our manufacturing capabilities?
            </h3>
            <p className="text-[var(--text-muted)]">
              Schedule a factory visit or request our capability document.
            </p>
          </div>
          <Link
            href="/contact"
            className="relative z-10 flex-shrink-0 bg-red-600 hover:bg-red-700 text-white font-bold px-8 py-4 rounded-xl transition-colors uppercase tracking-wider text-sm red-glow-sm"
          >
            Get in Touch
          </Link>
        </Reveal>
      </div>
    </section>
  );
}
