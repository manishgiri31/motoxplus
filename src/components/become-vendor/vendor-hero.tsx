import { BadgeCheck, Truck, Users, ArrowRight } from "lucide-react";
import { Container } from "@/components/store/container";
import { VendorStartCard } from "./vendor-start-card";

const INDEX = ["Engine", "Brakes", "Suspension", "Cables", "Bearings", "Electrical"];

const FACTS = [
  { Icon: Users, text: "Sell to B2B dealers and B2C customers" },
  { Icon: Truck, text: "MotoXPlus arranges shipping" },
  { Icon: BadgeCheck, text: "Active as soon as you verify" },
];

export function VendorHero() {
  return (
    <section aria-labelledby="hero-title" className="border-b border-black/10 bg-white">
      {/* DOM order is heading, signup card, facts, so phones reach the form right after the pitch; on desktop the
          card sits beside both. */}
      <Container className="grid gap-x-16 gap-y-10 py-10 bp-lg:grid-cols-[minmax(0,6fr)_minmax(0,5fr)] bp-lg:grid-rows-[auto_1fr] bp-lg:py-20">
        <div className="bp-lg:col-start-1 bp-lg:row-start-1 bp-lg:pt-6">
          <h1 id="hero-title" className="font-grotesk">
            <span className="flex items-center gap-3 text-[13px] font-semibold uppercase tracking-[0.2em] text-mx-red">
              <span aria-hidden className="h-px w-8 bg-current" />
              Sell on MotoXPlus
            </span>
            <span className="mt-6 block text-[clamp(34px,4.6vw,58px)] font-semibold leading-[1.05] tracking-[-0.035em] text-mx-black">
              Grow your spare parts business with India&apos;s automotive marketplace.
            </span>
          </h1>
          <p className="mt-6 max-w-[54ch] text-[18px] leading-relaxed text-[#4b4b52]">
            Manufacturers, wholesalers, distributors and stockists: create your vendor account in one step and reach
            dealers, retailers, workshops and customers across India.
          </p>
        </div>

        {/* The signup itself, so becoming a vendor is one step on this page. */}
        <div id="start" className="scroll-mt-24 bp-lg:col-start-2 bp-lg:row-span-2 bp-lg:row-start-1">
          <VendorStartCard />
        </div>

        <div className="bp-lg:col-start-1 bp-lg:row-start-2">

          <ul className="grid gap-px overflow-hidden border border-black/10 bg-black/10 sm:grid-cols-3">
            {FACTS.map(({ Icon, text }) => (
              <li key={text} className="flex items-start gap-3 bg-white p-4 text-[14px] leading-snug text-mx-black">
                <Icon aria-hidden className="mt-0.5 size-[18px] shrink-0 text-mx-red" />
                {text}
              </li>
            ))}
          </ul>

          <p className="mt-6 flex flex-wrap items-center gap-x-3 gap-y-1 font-grotesk text-[12px] font-semibold uppercase tracking-[0.14em] text-[#6b6b73]">
            <span className="text-mx-black">Sell</span>
            {INDEX.map((c) => (
              <span key={c} className="after:ml-3 after:text-mx-silver after:content-['/'] last:after:content-none">
                {c}
              </span>
            ))}
          </p>
          <a href="#how-it-works" className="mt-8 inline-flex items-center gap-2 text-[14px] font-semibold text-mx-black underline-offset-4 hover:underline">
            How it works <ArrowRight aria-hidden className="size-4" />
          </a>
        </div>
      </Container>
    </section>
  );
}
