import Image from "next/image";
import { BadgeCheck, Truck, Users, ArrowRight } from "lucide-react";
import { Container } from "@/components/store/container";
import { Button } from "@/components/ui/button";
import { getProducts, imageUrl } from "@/lib/store/products";
import { START_SELLING_HREF } from "@/lib/seller/config";
import { ctaClass, ctaOutlineDark } from "./styles";

// Real MotoXPlus catalogue photography only. We have no photographs of engine, brake or suspension parts
// yet, so those categories appear as the typographic index under the plates - never as invented imagery.
const PLATE_IDS = ["mx-control-cable", "mx-clutch-plate-set", "mx-front-mudguard", "mx-indicator-set"];
const INDEX = ["Engine", "Brakes", "Suspension", "Cables", "Bearings", "Electrical"];

const FACTS = [
  { Icon: Users, text: "Sell to B2B dealers and B2C customers" },
  { Icon: Truck, text: "MotoXPlus arranges shipping" },
  { Icon: BadgeCheck, text: "Every seller and listing is reviewed" },
];

export function VendorHero() {
  const all = getProducts();
  const plates = PLATE_IDS.map((id) => all.find((p) => p.id === id)).filter((p): p is NonNullable<typeof p> => !!p);

  return (
    <section aria-labelledby="hero-title" className="border-b border-black/10 bg-white">
      <Container className="grid gap-12 py-14 bp-lg:grid-cols-[minmax(0,7fr)_minmax(0,5fr)] bp-lg:items-center bp-lg:gap-16 bp-lg:py-24">
        <div>
          <h1 id="hero-title" className="font-grotesk">
            <span className="flex items-center gap-3 text-[13px] font-semibold uppercase tracking-[0.2em] text-mx-red">
              <span aria-hidden className="h-px w-8 bg-current" />
              Sell on MotoXPlus
            </span>
            <span className="mt-6 block text-[clamp(36px,5.2vw,64px)] font-semibold leading-[1.04] tracking-[-0.035em] text-mx-black">
              Grow your spare parts business with India&apos;s automotive marketplace.
            </span>
          </h1>
          <p className="mt-6 max-w-[58ch] text-[18px] leading-relaxed text-[#4b4b52]">
            Are you a manufacturer, wholesaler, distributor or automotive spare-parts stockist? Join MotoXPlus, list your
            products and connect with dealers, retailers, workshops and customers across India.
          </p>

          <div className="mt-9 flex flex-wrap gap-3">
            <Button asChild size="lg" className={ctaClass}>
              <a href={START_SELLING_HREF}>
                Start selling <ArrowRight aria-hidden />
              </a>
            </Button>
            <Button asChild size="lg" variant="ghost" className={ctaOutlineDark}>
              <a href="#how-it-works">How it works</a>
            </Button>
          </div>

          <ul className="mt-12 grid gap-px overflow-hidden border border-black/10 bg-black/10 sm:grid-cols-3">
            {FACTS.map(({ Icon, text }) => (
              <li key={text} className="flex items-start gap-3 bg-white p-4 text-[14px] leading-snug text-mx-black">
                <Icon aria-hidden className="mt-0.5 size-[18px] shrink-0 text-mx-red" />
                {text}
              </li>
            ))}
          </ul>
        </div>

        <div>
          <ul aria-label="Parts from the MotoXPlus catalogue" className="grid grid-cols-2 gap-px border border-black/10 bg-black/10">
            {plates.map((p, i) => (
              <li key={p.id} className="bg-mx-off">
                <figure className="m-0">
                  <div className="relative aspect-square">
                    <Image
                      src={imageUrl(p.images[0])}
                      alt={p.name}
                      fill
                      priority={i < 4}
                      sizes="(max-width: 1068px) 45vw, 22vw"
                      className="object-contain p-5 mix-blend-multiply"
                    />
                  </div>
                  <figcaption className="flex items-baseline justify-between gap-2 border-t border-black/10 bg-white px-4 py-3">
                    <span className="font-grotesk text-[14px] font-semibold text-mx-black">{p.name}</span>
                    <span className="text-[12px] text-[#6b6b73]">{p.category}</span>
                  </figcaption>
                </figure>
              </li>
            ))}
          </ul>
          <p className="mt-4 flex flex-wrap items-center gap-x-3 gap-y-1 font-grotesk text-[12px] font-semibold uppercase tracking-[0.14em] text-[#6b6b73]">
            <span className="text-mx-black">Sell</span>
            {INDEX.map((c) => (
              <span key={c} className="after:ml-3 after:text-mx-silver after:content-['/'] last:after:content-none">
                {c}
              </span>
            ))}
          </p>
        </div>
      </Container>
    </section>
  );
}
