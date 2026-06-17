import type { Metadata } from "next";
import { DealerRegistrationForm } from "@/components/dealer/registration-form";

export const metadata: Metadata = {
  title: "Become a Dealer",
  description: "Join the MotoXPlus India dealer network. Apply now for exclusive pricing and support.",
};

const benefits = [
  { icon: "◈", title: "Exclusive Pricing", desc: "Access competitive dealer prices with strong margin protection." },
  { icon: "◉", title: "Priority Stock", desc: "Never run out. Dealers get priority fulfillment and stock alerts." },
  { icon: "⬡", title: "Online Portal", desc: "Manage orders, download invoices, and track shipments 24/7." },
  { icon: "⬢", title: "Marketing Support", desc: "Get branded materials, product guides, and sales support." },
];

export default function BecomeDealerPage() {
  return (
    <div className="min-h-screen bg-[var(--bg-primary)]">
      {/* Hero */}
      <section className="py-20 px-4 md:px-8 relative overflow-hidden">
        <div className="absolute top-0 right-0 w-96 h-96 bg-red-950/15 rounded-full blur-[100px]" />
        <div className="max-w-7xl mx-auto relative z-10">
          <div className="grid grid-cols-1 lg:grid-cols-2 gap-16 items-center">
            <div>
              <div className="flex items-center gap-3 mb-6">
                <div className="w-8 h-px bg-red-600" />
                <span className="text-red-500 text-xs font-semibold uppercase tracking-widest">
                  Dealer Program
                </span>
              </div>
              <h1 className="text-5xl md:text-6xl font-black text-[var(--text-primary)] tracking-tight mb-6">
                Join Our<br />
                <span className="text-gradient-red">Dealer Network.</span>
              </h1>
              <p className="text-[var(--text-muted)] text-lg leading-relaxed mb-10">
                Become an authorized MotoXPlus India dealer and gain access to
                500+ premium products, competitive pricing, and dedicated support.
                Applications are reviewed within 2 business days.
              </p>

              <div className="grid grid-cols-2 gap-4">
                {benefits.map((b) => (
                  <div key={b.title} className="glass border border-[var(--border-color)] rounded-sm p-4">
                    <div className="text-2xl text-red-800 font-black mb-3">{b.icon}</div>
                    <h3 className="text-[var(--text-primary)] font-bold text-sm mb-1">{b.title}</h3>
                    <p className="text-[var(--text-muted)] text-xs leading-relaxed">{b.desc}</p>
                  </div>
                ))}
              </div>
            </div>

            {/* Form */}
            <DealerRegistrationForm />
          </div>
        </div>
      </section>
    </div>
  );
}
