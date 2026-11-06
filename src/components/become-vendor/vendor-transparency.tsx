import { Check } from "lucide-react";
import { Container } from "@/components/store/container";
import { TRANSPARENCY_POINTS } from "./content";
import { SectionHeading } from "./section-heading";

export function VendorTransparency() {
  return (
    <section aria-labelledby="clear-title" className="border-y border-black/10 bg-mx-off py-[clamp(56px,8vw,112px)]">
      <Container className="grid gap-12 bp-lg:grid-cols-[minmax(0,5fr)_minmax(0,6fr)] bp-lg:gap-20">
        <SectionHeading
          index="04"
          eyebrow="Money, shipping & deductions"
          title="Simple, transparent selling"
          lead="You see what is charged and why. The commission and payout terms are agreed with you before you sell. This page does not quote a commission rate or a payout timeline."
          id="clear-title"
        />
        <ul className="border-t border-black/15">
          {TRANSPARENCY_POINTS.map((p) => (
            <li key={p} className="flex gap-4 border-b border-black/15 py-5 text-[16px] leading-relaxed text-mx-black">
              <Check aria-hidden className="mt-1 size-[18px] shrink-0 text-mx-red" strokeWidth={2.25} />
              {p}
            </li>
          ))}
        </ul>
      </Container>
    </section>
  );
}
