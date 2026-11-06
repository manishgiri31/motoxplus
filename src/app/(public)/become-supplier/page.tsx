import type { Metadata } from "next";
import { PackageCheck, Landmark, LayoutDashboard, Handshake } from "lucide-react";
import { VendorRegistrationForm } from "@/components/vendor/vendor-registration-form";
import { Eyebrow } from "@/components/ui/technical";
import { Card } from "@/components/ui/card";
import { getPartCategoryTree } from "@/lib/catalog/part-categories";

export const metadata: Metadata = {
  title: "Become a Vendor | MotoXPlus India",
  description: "Manufacturers and suppliers of two-wheeler, three-wheeler and car spare parts: apply to supply MotoXPlus India Private Limited.",
};

const benefits = [
  { Icon: PackageCheck, title: "Steady Orders", desc: "Consistent purchase orders from a growing manufacturer with 500+ SKUs." },
  { Icon: Landmark, title: "Timely Payments", desc: "Structured payment cycles — NEFT/RTGS with clear credit terms." },
  { Icon: LayoutDashboard, title: "Vendor Portal", desc: "Track purchase orders, confirm deliveries, and view payment history online." },
  { Icon: Handshake, title: "Long-term Partnership", desc: "Preferred vendor status with performance-linked benefits and priority." },
];

export default async function BecomeSupplierPage() {
  // Admin-managed (Admin -> Categories); fall back to no list rather than failing the page.
  const groups = await getPartCategoryTree().catch(() => []);
  return (
    <div className="min-h-screen bg-[var(--paper)]">
      <section className="py-16 md:py-20 px-4 md:px-8">
        <div className="max-w-7xl mx-auto">
          <div className="grid grid-cols-1 lg:grid-cols-2 gap-16 items-start">
            <div className="lg:sticky lg:top-28">
              <Eyebrow className="mb-5">Vendor Program</Eyebrow>
              <h1 className="font-display text-[clamp(36px,5.5vw,56px)] leading-[1.08] font-bold text-[var(--ink)] tracking-tight mb-6">
                Supply to MotoXPlus.
              </h1>
              <p className="text-[var(--muted)] text-lg leading-relaxed mb-10">
                We are actively expanding our supplier network. If you manufacture or supply
                automotive spare parts — fasteners, engine, electrical, body, brake and more — apply now.
                All applications are reviewed by our procurement team.
              </p>

              <div className="grid grid-cols-2 gap-4 mb-8">
                {benefits.map((b) => (
                  <Card key={b.title} pad="md" className="rounded-[18px] border-transparent bg-[var(--card)]">
                    <b.Icon size={20} className="text-[var(--red)] mb-3" />
                    <h3 className="text-[var(--ink)] font-bold text-sm mb-1">{b.title}</h3>
                    <p className="text-[var(--muted)] text-xs leading-relaxed">{b.desc}</p>
                  </Card>
                ))}
              </div>

              {groups.length > 0 && <Card pad="lg">
                <p className="text-[var(--muted)] text-xs mb-3 font-bold">Parts categories we source</p>
                <div className="flex flex-wrap gap-2">
                  {groups.map((g) => (
                    <span key={g.id} className="text-xs border border-[var(--line)] px-3 py-1.5 text-[var(--muted)]">{g.name}</span>
                  ))}
                </div>
              </Card>}
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
