import type { Metadata } from "next";
import { Percent, PackageCheck, LayoutDashboard, Megaphone } from "lucide-react";
import { DealerRegistrationForm } from "@/components/dealer/registration-form";
import { Eyebrow } from "@/components/ui/technical";
import { Card } from "@/components/ui/card";

export const metadata: Metadata = {
  title: "Become a Dealer",
  description: "Join the MotoXPlus India dealer network. Apply now for exclusive pricing and support.",
};

const benefits = [
  { Icon: Percent, title: "Exclusive Pricing", desc: "Access competitive dealer prices with strong margin protection." },
  { Icon: PackageCheck, title: "Priority Stock", desc: "Never run out. Dealers get priority fulfillment and stock alerts." },
  { Icon: LayoutDashboard, title: "Online Portal", desc: "Manage orders, download invoices, and track shipments 24/7." },
  { Icon: Megaphone, title: "Marketing Support", desc: "Get branded materials, product guides, and sales support." },
];

export default function BecomeDealerPage() {
  return (
    <div className="min-h-screen bg-[var(--paper)]">
      <section className="py-16 md:py-20 px-4 md:px-8">
        <div className="max-w-7xl mx-auto">
          <div className="grid grid-cols-1 lg:grid-cols-2 gap-16 items-start">
            <div className="lg:sticky lg:top-28">
              <Eyebrow className="mb-5">Dealer Program</Eyebrow>
              <h1 className="font-display text-4xl md:text-5xl font-bold text-[var(--ink)] tracking-tight mb-6">
                Join our dealer network.
              </h1>
              <p className="text-[var(--muted)] text-lg leading-relaxed mb-10">
                Become an authorized MotoXPlus India dealer and gain access to
                500+ premium products, competitive pricing, and dedicated support.
                Sign up, verify your email and mobile, and you&apos;re in — no approval wait.
              </p>

              <div className="grid grid-cols-2 gap-px bg-[var(--line)] border border-[var(--line)]">
                {benefits.map((b) => (
                  <Card key={b.title} pad="md" className="rounded-none border-0">
                    <b.Icon size={20} className="text-[var(--red)] mb-3" />
                    <h3 className="text-[var(--ink)] font-bold text-sm mb-1">{b.title}</h3>
                    <p className="text-[var(--muted)] text-xs leading-relaxed">{b.desc}</p>
                  </Card>
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
