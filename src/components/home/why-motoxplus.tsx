"use client";

import { ShieldCheck, Microscope, Award, Network } from "lucide-react";

const features = [
  {
    title: "OEM Compatible",
    description: "Every part is engineered to meet or exceed original equipment manufacturer specifications.",
    Icon: ShieldCheck,
    stat: "100%",
    statLabel: "OEM Fit",
  },
  {
    title: "Quality Tested",
    description: "Rigorous multi-stage quality control processes ensure every component meets our standards.",
    Icon: Microscope,
    stat: "ISO",
    statLabel: "Certified",
  },
  {
    title: "Built to Last",
    description: "Premium materials and precision manufacturing deliver exceptional durability and longevity.",
    Icon: Award,
    stat: "3×",
    statLabel: "Lifespan",
  },
  {
    title: "Dealer Network",
    description: "Extensive dealer network across 18+ states ensuring fast delivery and local support.",
    Icon: Network,
    stat: "18+",
    statLabel: "States",
  },
];

export function WhyMotoXPlus() {
  return (
    <section className="py-24 px-4 md:px-8 bg-[var(--bg-secondary)] relative overflow-hidden">
      {/* Background elements */}
      <div className="absolute top-0 right-0 w-96 h-96 bg-red-950/20 rounded-full blur-[100px] pointer-events-none" />
      <div className="absolute bottom-0 left-0 w-64 h-64 bg-red-950/10 rounded-full blur-[80px] pointer-events-none" />

      <div className="max-w-7xl mx-auto relative z-10">
        <div className="grid grid-cols-1 lg:grid-cols-2 gap-16 items-center">
          {/* Left */}
          <div>
            <div className="flex items-center gap-3 mb-6">
              <div className="w-8 h-px bg-red-600" />
              <span className="text-red-500 text-xs font-semibold uppercase tracking-widest">
                Why Choose Us
              </span>
            </div>
            <h2 className="text-4xl md:text-5xl font-black text-[var(--text-primary)] tracking-tight mb-6">
              The MOTOXPLUS<br />
              <span className="text-gradient-red">Advantage.</span>
            </h2>
            <p className="text-[var(--text-muted)] leading-relaxed text-lg mb-8">
              We combine advanced manufacturing technology with deep domain expertise
              in two-wheeler engineering to deliver parts that perform when it matters most.
            </p>

            <div className="flex items-center gap-6 glass border border-[var(--border-color)] rounded-sm p-6">
              <div className="text-7xl font-black text-red-900/40 leading-none select-none">15+</div>
              <div>
                <div className="text-[var(--text-primary)] font-bold text-xl mb-1">Years of Excellence</div>
                <div className="text-[var(--text-muted)] text-sm">
                  Trusted by thousands of dealers and workshops across India
                </div>
              </div>
            </div>
          </div>

          {/* Right grid */}
          <div className="grid grid-cols-2 gap-4">
            {features.map((feature) => (
              <div
                key={feature.title}
                className="group glass border border-[var(--border-color)] hover:border-red-900/40 rounded-sm p-6 transition-all duration-300 card-hover"
              >
                {/* Icon */}
                <div className="w-10 h-10 rounded-sm bg-red-900/20 group-hover:bg-red-900/30 flex items-center justify-center mb-4 transition-colors">
                  <feature.Icon size={20} className="text-red-500 group-hover:text-red-400 transition-colors" />
                </div>

                <div className="flex items-baseline gap-1 mb-2">
                  <span className="text-2xl font-black text-[var(--text-primary)]">{feature.stat}</span>
                  <span className="text-red-500 text-xs font-semibold uppercase">{feature.statLabel}</span>
                </div>
                <h3 className="text-[var(--text-primary)] font-bold mb-2">{feature.title}</h3>
                <p className="text-[var(--text-muted)] text-xs leading-relaxed">{feature.description}</p>
              </div>
            ))}
          </div>
        </div>
      </div>
    </section>
  );
}
