import { Container } from "@/components/store/container";
import { STEPS } from "./content";
import { SectionHeading } from "./section-heading";

/** Horizontal six-step line on desktop, vertical rail on mobile. Pure CSS - no client JS. */
export function VendorHowItWorks() {
  return (
    <section id="how-it-works" aria-labelledby="how-title" className="scroll-mt-24 bg-white py-[clamp(56px,8vw,112px)]">
      <Container>
        <SectionHeading index="03" eyebrow="How it works" title="From registration to settlement in six steps" id="how-title" />
        <ol className="mt-14 grid gap-0 bp-lg:grid-cols-6 bp-lg:gap-6">
          {STEPS.map((s, i) => (
            <li
              key={s.title}
              className={
                "relative pb-10 pl-16 last:pb-0 bp-lg:pb-0 bp-lg:pl-0 bp-lg:pt-16 " +
                // connector: vertical on mobile, horizontal on desktop; hidden after the last step
                "before:absolute before:left-5 before:top-10 before:h-full before:w-px before:bg-mx-silver " +
                "bp-lg:before:left-10 bp-lg:before:top-5 bp-lg:before:h-px bp-lg:before:w-[calc(100%-1.5rem)] " +
                "last:before:hidden"
              }
            >
              <span
                aria-hidden
                className="absolute left-0 top-0 grid size-10 place-items-center border-2 border-mx-black bg-white font-grotesk text-[15px] font-semibold tabular-nums text-mx-black"
              >
                {i + 1}
              </span>
              <h3 className="font-grotesk text-[14px] font-semibold uppercase tracking-[0.1em] text-mx-black">
                <span className="sr-only">Step {i + 1}: </span>
                {s.title}
              </h3>
              <p className="mt-2 text-[15px] leading-relaxed text-[#4b4b52]">{s.body}</p>
            </li>
          ))}
        </ol>
      </Container>
    </section>
  );
}
