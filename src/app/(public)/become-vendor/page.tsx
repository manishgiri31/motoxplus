import type { Metadata } from "next";
import { VendorRegistrationForm } from "@/components/vendor/vendor-registration-form";

export const metadata: Metadata = {
  title: "Become a Vendor | MotoXPlus India",
  description: "Apply to supply raw materials, components, packaging, or services to MotoXPlus India Private Limited.",
};

const benefits = [
  { icon: "◈", title: "Steady Orders", desc: "Consistent purchase orders from a growing manufacturer with 500+ SKUs." },
  { icon: "◉", title: "Timely Payments", desc: "Structured payment cycles — NEFT/RTGS with clear credit terms." },
  { icon: "⬡", title: "Vendor Portal", desc: "Track purchase orders, confirm deliveries, and view payment history online." },
  { icon: "⬢", title: "Long-term Partnership", desc: "Preferred vendor status with performance-linked benefits and priority." },
];

export default function BecomeVendorPage() {
  return (
    <div className="min-h-screen bg-[var(--bg-primary)]">
      <section className="py-20 px-4 md:px-8 relative overflow-hidden">
        <div className="absolute top-0 left-0 w-96 h-96 bg-red-950/15 rounded-full blur-[100px]" />
        <div className="max-w-7xl mx-auto relative z-10">
          <div className="grid grid-cols-1 lg:grid-cols-2 gap-16 items-start">
            <div className="lg:pt-4">
              <div className="flex items-center gap-3 mb-6">
                <div className="w-8 h-px bg-red-600" />
                <span className="text-red-500 text-xs font-semibold uppercase tracking-widest">Vendor Program</span>
              </div>
              <h1 className="text-5xl md:text-6xl font-black text-[var(--text-primary)] tracking-tight mb-6">
                Supply to<br />
                <span className="text-gradient-red">MotoXPlus.</span>
              </h1>
              <p className="text-[var(--text-muted)] text-lg leading-relaxed mb-10">
                We are actively expanding our supplier network. If you supply raw materials,
                packaging, components, logistics, or related services — apply now.
                All applications are reviewed by our procurement team.
              </p>

              <div className="grid grid-cols-2 gap-4 mb-10">
                {benefits.map((b) => (
                  <div key={b.title} className="glass border border-[var(--border-color)] rounded-sm p-4">
                    <div className="text-2xl text-red-800 font-black mb-3">{b.icon}</div>
                    <h3 className="text-[var(--text-primary)] font-bold text-sm mb-1">{b.title}</h3>
                    <p className="text-[var(--text-muted)] text-xs leading-relaxed">{b.desc}</p>
                  </div>
                ))}
              </div>

              <div className="glass border border-[var(--border-color)] rounded-sm p-5">
                <p className="text-[var(--text-muted)] text-xs uppercase tracking-widest mb-3 font-bold">Categories we source</p>
                <div className="flex flex-wrap gap-2">
                  {["Raw Materials", "Packaging", "Printing", "Logistics", "Manufacturing Components", "Tooling", "Services"].map((cat) => (
                    <span key={cat} className="text-xs bg-white/5 border border-[var(--border-color)] px-3 py-1.5 rounded-sm text-[var(--text-muted)]">{cat}</span>
                  ))}
                </div>
              </div>
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
