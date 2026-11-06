import { Container } from "@/components/store/container";
import { BENEFITS } from "./content";
import { SectionHeading } from "./section-heading";

export function VendorBenefits() {
  return (
    <section aria-labelledby="benefits-title" className="bg-mx-off py-[clamp(56px,8vw,112px)]">
      <Container>
        <SectionHeading index="01" eyebrow="Why sell here" title="Everything you need to sell and grow" id="benefits-title" />
        <ul className="mt-12 grid sm:grid-cols-2 bp-lg:grid-cols-3 sm:gap-x-10">
          {BENEFITS.map(({ Icon, title, body }, i) => (
            <li key={title} className="border-t border-black/15 py-8">
              <div className="flex items-center justify-between">
                <span className="font-grotesk text-[13px] font-semibold tabular-nums text-[#6b6b73]">
                  {String(i + 1).padStart(2, "0")}
                </span>
                <Icon aria-hidden className="size-6 text-mx-red" strokeWidth={1.75} />
              </div>
              <h3 className="mt-6 font-grotesk text-[15px] font-semibold uppercase tracking-[0.08em] text-mx-black">{title}</h3>
              <p className="mt-2 max-w-[34ch] text-[16px] leading-relaxed text-[#4b4b52]">{body}</p>
            </li>
          ))}
        </ul>
      </Container>
    </section>
  );
}
