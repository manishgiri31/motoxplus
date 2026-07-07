"use client";

import { ShieldCheck, Microscope, Award, Network } from "lucide-react";
import { TiltCard } from "@/components/3d/tilt-card";

const features = [
  {
    title: "OEM Compatible",
    description: "Every part is engineered to meet or exceed original equipment manufacturer specifications.",
    Icon: ShieldCheck,
    stat: "100%",
    statLabel: "OEM Fit",
    accent: "from-red-500/10 to-transparent",
    iconBg: "bg-red-500/10 group-hover:bg-red-500/15",
    iconColor: "text-red-500 group-hover:text-red-600",
    statColor: "text-red-500",
  },
  {
    title: "Quality Tested",
    description: "Rigorous multi-stage quality control processes ensure every component meets our standards.",
    Icon: Microscope,
    stat: "ISO",
    statLabel: "Certified",
    accent: "from-blue-500/10 to-transparent",
    iconBg: "bg-blue-500/10 group-hover:bg-blue-500/15",
    iconColor: "text-blue-500 group-hover:text-blue-600",
    statColor: "text-blue-500",
  },
  {
    title: "Built to Last",
    description: "Premium materials and precision manufacturing deliver exceptional durability and longevity.",
    Icon: Award,
    stat: "3×",
    statLabel: "Lifespan",
    accent: "from-amber-500/10 to-transparent",
    iconBg: "bg-amber-500/10 group-hover:bg-amber-500/15",
    iconColor: "text-amber-500 group-hover:text-amber-600",
    statColor: "text-amber-500",
  },
  {
    title: "Dealer Network",
    description: "Extensive dealer network across 18+ states ensuring fast delivery and local support.",
    Icon: Network,
    stat: "18+",
    statLabel: "States",
    accent: "from-green-500/10 to-transparent",
    iconBg: "bg-green-500/10 group-hover:bg-green-500/15",
    iconColor: "text-green-500 group-hover:text-green-600",
    statColor: "text-green-500",
  },
];

export function WhyMotoXPlus() {
  return (
    <section className="py-24 px-4 md:px-8 bg-[var(--bg-secondary)] relative overflow-hidden">
      {/* Background elements */}
      <div className="absolute top-0 right-0 w-96 h-96 bg-red-500/10 rounded-full blur-[110px] pointer-events-none" />
      <div className="absolute bottom-0 left-0 w-64 h-64 bg-red-500/10 rounded-full blur-[80px] pointer-events-none" />

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

            <div className="flex items-center gap-6 glass border border-[var(--border-color)] shadow-sm rounded-2xl p-6 relative overflow-hidden">
              <div className="absolute inset-0 bg-gradient-to-br from-red-500/10 to-transparent rounded-2xl" />
              <div className="text-8xl font-black text-red-500/15 leading-none select-none relative z-10">15+</div>
              <div className="relative z-10">
                <div className="text-[var(--text-primary)] font-bold text-xl mb-1">Years of Excellence</div>
                <div className="text-[var(--text-muted)] text-sm leading-relaxed">
                  Trusted by thousands of dealers and workshops across India
                </div>
              </div>
            </div>
          </div>

          {/* Right grid */}
          <div className="grid grid-cols-2 gap-4">
            {features.map((feature) => (
              <TiltCard key={feature.title} intensity={10}>
                <div className="group glass border border-[var(--border-color)] shadow-sm hover:shadow-md hover:border-red-900/40 rounded-2xl p-6 transition-all duration-300 relative overflow-hidden">
                  <div className={`absolute inset-0 bg-gradient-to-br ${feature.accent} opacity-0 group-hover:opacity-100 transition-opacity duration-300 rounded-2xl`} />

                  <div className={`relative z-10 w-11 h-11 rounded-xl flex items-center justify-center mb-5 transition-colors border border-transparent ${feature.iconBg}`}>
                    <feature.Icon size={20} className={`transition-colors ${feature.iconColor}`} />
                  </div>

                  <div className="relative z-10 flex items-baseline gap-1 mb-1.5">
                    <span className={`text-2xl font-black ${feature.statColor}`}>{feature.stat}</span>
                    <span className="text-[var(--text-muted)] text-[10px] font-bold uppercase tracking-wider">{feature.statLabel}</span>
                  </div>
                  <h3 className="relative z-10 text-[var(--text-primary)] font-bold mb-2 text-sm">{feature.title}</h3>
                  <p className="relative z-10 text-[var(--text-muted)] text-xs leading-relaxed">{feature.description}</p>
                </div>
              </TiltCard>
            ))}
          </div>
        </div>
      </div>
    </section>
  );
}
