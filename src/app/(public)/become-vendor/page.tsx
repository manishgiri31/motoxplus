import type { Metadata } from "next";
import { PackageCheck, Landmark, LayoutDashboard, Handshake } from "lucide-react";
import { VendorRegistrationForm } from "@/components/vendor/vendor-registration-form";
import { Eyebrow } from "@/components/ui/technical";
import { Card } from "@/components/ui/card";

export const metadata: Metadata = {
  title: "Become a Vendor | MotoXPlus India",
  description: "Apply to supply raw materials, components, packaging, or services to MotoXPlus India Private Limited.",
};

const benefits = [
  { Icon: PackageCheck, title: "Steady Orders", desc: "Consistent purchase orders from a growing manufacturer with 500+ SKUs." },
  { Icon: Landmark, title: "Timely Payments", desc: "Structured payment cycles — NEFT/RTGS with clear credit terms." },
  { Icon: LayoutDashboard, title: "Vendor Portal", desc: "Track purchase orders, confirm deliveries, and view payment history online." },
  { Icon: Handshake, title: "Long-term Partnership", desc: "Preferred vendor status with performance-linked benefits and priority." },
];

const categories = ["Raw Materials", "Packaging", "Printing", "Logistics", "Manufacturing Components", "Tooling", "Services"];

export default function BecomeVendorPage() {
  return (
    <div className="min-h-screen bg-[var(--paper)]">
      <section className="py-16 md:py-20 px-4 md:px-8">
        <div className="max-w-7xl mx-auto">
          <div className="grid grid-cols-1 lg:grid-cols-2 gap-16 items-start">
            <div className="lg:sticky lg:top-28">
              <Eyebrow className="mb-5">Vendor Program</Eyebrow>
              <h1 className="font-display text-4xl md:text-5xl font-bold text-[var(--ink)] tracking-tight mb-6">
                Supply to MotoXPlus.
              </h1>
              <p className="text-[var(--muted)] text-lg leading-relaxed mb-10">
                We are actively expanding our supplier network. If you supply raw materials,
                packaging, components, logistics, or related services — apply now.
                All applications are reviewed by our procurement team.
              </p>

              <div className="grid grid-cols-2 gap-px bg-[var(--line)] border border-[var(--line)] mb-8">
                {benefits.map((b) => (
                  <Card key={b.title} pad="md" className="rounded-none border-0">
                    <b.Icon size={20} className="text-[var(--red)] mb-3" />
                    <h3 className="text-[var(--ink)] font-bold text-sm mb-1">{b.title}</h3>
                    <p className="text-[var(--muted)] text-xs leading-relaxed">{b.desc}</p>
                  </Card>
                ))}
              </div>

              <Card pad="lg">
                <p className="text-[var(--muted)] text-xs uppercase tracking-widest mb-3 font-bold">Categories we source</p>
                <div className="flex flex-wrap gap-2">
                  {categories.map((cat) => (
                    <span key={cat} className="text-xs border border-[var(--line)] px-3 py-1.5 text-[var(--muted)]">{cat}</span>
                  ))}
                </div>
              </Card>
            </div>

            <div>
              <VendorRegistrationForm />
            </div>
          </div>
        </div>
      </section>
    </div>
  );
}
