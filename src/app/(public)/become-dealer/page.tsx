import type { Metadata } from "next";
import { Percent, PackageCheck, LayoutDashboard, Megaphone } from "lucide-react";
import { getServerSession } from "next-auth";
import { redirect } from "next/navigation";
import { authOptions } from "@/lib/auth";
import { DealerRegistrationForm } from "@/components/dealer/registration-form";
import { AttachDealerProfile } from "@/components/dealer/attach-dealer-profile";
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

export default async function BecomeDealerPage() {
  // One login, several profiles: a signed-in vendor adds a dealer profile to the same account instead of a new one.
  const session = await getServerSession(authOptions);
  if (session?.user?.role === "DEALER") redirect("/dealer/dashboard");
  const vendor = session?.user?.role === "VENDOR" ? session.user : null;

  return (
    <div className="min-h-screen bg-[var(--paper)]">
      <section className="py-16 md:py-20 px-4 md:px-8">
        <div className="max-w-7xl mx-auto">
          <div className="grid grid-cols-1 lg:grid-cols-2 gap-16 items-start">
            <div className="lg:sticky lg:top-28">
              <Eyebrow className="mb-5">Dealer Program</Eyebrow>
              <h1 className="font-display text-[clamp(36px,5.5vw,56px)] leading-[1.08] font-bold text-[var(--ink)] tracking-tight mb-6">
                Join our dealer network.
              </h1>
              <p className="text-[var(--muted)] text-lg leading-relaxed mb-10">
                Become an authorized MotoXPlus India dealer and gain access to
                500+ premium products, competitive pricing, and dedicated support.
                Sign up, verify your email and mobile, and you&apos;re in — no approval wait.
              </p>

              <div className="grid grid-cols-2 gap-4">
                {benefits.map((b) => (
                  <Card key={b.title} pad="md" className="rounded-[18px] border-transparent bg-[var(--card)]">
                    <b.Icon size={20} className="text-[var(--red)] mb-3" />
                    <h3 className="text-[var(--ink)] font-bold text-sm mb-1">{b.title}</h3>
                    <p className="text-[var(--muted)] text-xs leading-relaxed">{b.desc}</p>
                  </Card>
                ))}
              </div>
            </div>

            {/* Form */}
            {vendor?.email ? <AttachDealerProfile email={vendor.email} hasDealer={!!vendor.dealerId} /> : <DealerRegistrationForm />}
          </div>
        </div>
      </section>
    </div>
  );
}
