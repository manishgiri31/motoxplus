import { ShieldCheck, Microscope, Award, Network } from "lucide-react";
import { Eyebrow } from "@/components/ui/technical";
import { Card } from "@/components/ui/card";

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
    <section className="py-20 md:py-28 px-4 md:px-8 bg-[var(--card)] border-y border-[var(--line)]">
      <div className="max-w-7xl mx-auto">
        <div className="grid grid-cols-1 lg:grid-cols-2 gap-14 items-start">
          {/* Left */}
          <div>
            <Eyebrow className="mb-4">Why Choose Us</Eyebrow>
            <h2 className="font-display text-3xl md:text-4xl font-bold text-[var(--ink)] tracking-tight mb-5">
              The MOTOXPLUS advantage.
            </h2>
            <p className="text-[var(--muted)] leading-relaxed mb-8 max-w-md">
              We combine advanced manufacturing technology with deep domain expertise
              in two-wheeler engineering to deliver parts that perform when it matters most.
            </p>

            <Card edge="accent" pad="lg" className="flex items-center gap-6">
              <div className="tnum font-display text-7xl font-bold text-[var(--line)] leading-none select-none">
                15+
              </div>
              <div>
                <div className="text-[var(--ink)] font-bold text-lg mb-1">Years of Excellence</div>
                <div className="text-[var(--muted)] text-sm leading-relaxed">
                  Trusted by thousands of dealers and workshops across India
                </div>
              </div>
            </Card>
          </div>

          {/* Right grid */}
          <div className="grid grid-cols-2 gap-px bg-[var(--line)] border border-[var(--line)]">
            {features.map((feature) => (
              <Card key={feature.title} pad="lg" className="rounded-none border-0">
                <feature.Icon size={20} className="text-[var(--muted)] mb-4" />
                <div className="flex items-baseline gap-1.5 mb-1.5">
                  <span className="tnum font-display text-2xl font-bold text-[var(--red)]">{feature.stat}</span>
                  <span className="text-[var(--muted)] text-[10px] font-bold uppercase tracking-wider">{feature.statLabel}</span>
                </div>
                <h3 className="text-[var(--ink)] font-bold mb-1.5 text-sm">{feature.title}</h3>
                <p className="text-[var(--muted)] text-xs leading-relaxed">{feature.description}</p>
              </Card>
            ))}
          </div>
        </div>
      </div>
    </section>
  );
}
