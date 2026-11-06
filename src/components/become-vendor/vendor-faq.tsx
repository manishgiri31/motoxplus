"use client";

import { useId, useState } from "react";
import { ChevronDown } from "lucide-react";
import { Container } from "@/components/store/container";
import { cn } from "@/lib/utils";
import { FAQS } from "./content";
import { SectionHeading } from "./section-heading";

export function VendorFAQ() {
  const base = useId();
  const [open, setOpen] = useState<number | null>(0);

  return (
    <section id="faq" aria-labelledby="faq-title" className="scroll-mt-24 bg-mx-off py-[clamp(56px,8vw,112px)]">
      <Container className="grid gap-12 bp-lg:grid-cols-[minmax(0,4fr)_minmax(0,8fr)] bp-lg:gap-20">
        <SectionHeading index="06" eyebrow="FAQ" title="Questions sellers ask" id="faq-title" />
        <div className="border-t border-black/15">
          {FAQS.map((f, i) => {
            const isOpen = open === i;
            const buttonId = `${base}-q${i}`;
            const panelId = `${base}-a${i}`;
            return (
              <div key={f.q} className="border-b border-black/15">
                <h3>
                  <button
                    id={buttonId}
                    type="button"
                    aria-expanded={isOpen}
                    aria-controls={panelId}
                    onClick={() => setOpen(isOpen ? null : i)}
                    className="flex w-full items-center justify-between gap-6 py-5 text-left font-grotesk text-[18px] font-semibold leading-snug tracking-[-0.01em] text-mx-black hover:text-mx-red-deep focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-mx-black"
                  >
                    {f.q}
                    <ChevronDown
                      aria-hidden
                      className={cn("size-5 shrink-0 text-mx-red transition-transform duration-200 motion-reduce:transition-none", isOpen && "rotate-180")}
                    />
                  </button>
                </h3>
                {/* grid-rows 0fr -> 1fr animates height without measuring; hidden panels stay out of the tab order */}
                <div
                  id={panelId}
                  role="region"
                  aria-labelledby={buttonId}
                  className={cn(
                    "grid transition-[grid-template-rows] duration-200 ease-out motion-reduce:transition-none",
                    isOpen ? "grid-rows-[1fr]" : "grid-rows-[0fr]"
                  )}
                >
                  <div className="overflow-hidden">
                    <p className={cn("max-w-[64ch] pb-6 text-[16px] leading-relaxed text-[#4b4b52]", !isOpen && "invisible")}>{f.a}</p>
                  </div>
                </div>
              </div>
            );
          })}
        </div>
      </Container>
    </section>
  );
}
