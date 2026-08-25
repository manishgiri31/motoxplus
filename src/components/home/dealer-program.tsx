import Link from "next/link";
import { ArrowRight, CheckCircle2, Quote } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import { Eyebrow, SpecTable } from "@/components/ui/technical";

const benefits = [
  "Exclusive dealer pricing and margin protection",
  "Priority stock allocation and fulfillment",
  "Dedicated dealer support team",
  "Online order management portal",
  "Net-30 credit terms for approved dealers",
  "GST-compliant invoice generation",
];

const dealerStats = [
  { label: "Active Dealers", value: "500+" },
  { label: "States Covered", value: "18" },
  { label: "Avg. Delivery Time", value: "48h" },
  { label: "Order Fulfilment Rate", value: "98%" },
  { label: "Dealer Satisfaction", value: "4.8", unit: "/5" },
];

const testimonials = [
  {
    quote: "Fitment accuracy has been consistent across every batch — our customers rarely come back with compatibility complaints.",
    role: "Multi-brand distributor, North India",
  },
  {
    quote: "The online portal makes reordering stock a five-minute job instead of a phone-call chase.",
    role: "Spares retailer, West India",
  },
  {
    quote: "Every batch comes with test data we can show our own customers — that's what sold us.",
    role: "Workshop supply chain, South India",
  },
];

export function DealerProgram() {
  return (
    <section className="py-20 md:py-28 px-4 md:px-8 bg-[var(--card)]">
      <div className="max-w-7xl mx-auto">
        <div className="grid grid-cols-1 lg:grid-cols-2 gap-14 items-start mb-16">
          {/* Left */}
          <div>
            <Eyebrow className="mb-4">Dealer Program</Eyebrow>
            <h2 className="font-display text-3xl md:text-4xl font-bold text-[var(--ink)] tracking-tight mb-5">
              Grow your business with MOTOXPLUS.
            </h2>
            <p className="text-[var(--muted)] leading-relaxed mb-8 max-w-md">
              Join our network of 500+ dealers across India. Get access to premium
              products, competitive pricing, and the tools you need to serve your
              customers better.
            </p>

            <ul className="grid grid-cols-1 sm:grid-cols-2 gap-x-6 gap-y-2.5 mb-9">
              {benefits.map((benefit) => (
                <li key={benefit} className="flex items-start gap-2.5 py-1">
                  <CheckCircle2 size={15} className="text-[var(--red)] flex-shrink-0 mt-0.5" />
                  <span className="text-[var(--ink)]/80 text-sm leading-snug">{benefit}</span>
                </li>
              ))}
            </ul>

            <Button asChild variant="brand" size="lg">
              <Link href="/become-dealer" className="group">
                Apply Now — It&apos;s Free
                <ArrowRight size={16} className="group-hover:translate-x-0.5 transition-transform" />
              </Link>
            </Button>
          </div>

          {/* Right — Stats panel */}
          <Card edge="accent" pad="lg" className="lg:self-center">
            <h3 className="text-[var(--ink)] font-bold text-sm uppercase tracking-wider mb-4">
              Dealer Network Stats
            </h3>
            <SpecTable rows={dealerStats} />
          </Card>
        </div>

        {/* Testimonials strip */}
        <div className="border-t border-[var(--line)] pt-12 grid grid-cols-1 md:grid-cols-3 gap-8 md:gap-10">
          {testimonials.map((t) => (
            <div key={t.role} className="md:border-l md:border-[var(--line)] md:pl-8 first:md:border-l-0 first:md:pl-0">
              <Quote size={18} className="text-[var(--red)]/40 mb-3" />
              <p className="text-[var(--ink)]/80 text-sm leading-relaxed mb-3">&ldquo;{t.quote}&rdquo;</p>
              <p className="text-[var(--muted)] text-xs font-medium">{t.role}</p>
            </div>
          ))}
        </div>
      </div>
    </section>
  );
}
