import { MediaSlot } from "@/components/ui/media";
import { Eyebrow } from "@/components/ui/technical";
import { Reveal } from "@/components/ui/reveal";

/** Section 11 — restrained brand statement over facility imagery. Uses literal
 *  white text (not --ink/--muted) since this sits in a dark, data-surface="invert"
 *  island — see the note on MediaHero for why the v2 tokens don't invert here. */
export function MadeInIndia() {
  return (
    <section data-surface="invert" className="relative overflow-hidden bg-[rgb(var(--carbon-1000))] py-24 md:py-32">
      <div className="absolute inset-0 opacity-45">
        <MediaSlot id="about.facility.exterior" sizes="100vw" fit="cover" className="h-full w-full" />
      </div>
      <div aria-hidden className="absolute inset-0 bg-gradient-to-t from-black via-black/60 to-black/50" />

      <Reveal className="relative z-[1] mx-auto max-w-3xl px-4 text-center md:px-8">
        <Eyebrow index="11" rule className="mb-6 justify-center">
          Made in India
        </Eyebrow>
        <h2 className="font-display text-3xl font-bold leading-[1.05] tracking-tight text-white md:text-5xl">
          Made in India.
          <br />
          Engineered for India.
        </h2>
        <p className="mx-auto mt-6 max-w-xl text-base leading-relaxed text-white/70 md:text-lg">
          Every component is designed, manufactured and quality-checked at our own
          facility — built for the roads, climate and duty cycles of the Indian market.
        </p>
      </Reveal>
    </section>
  );
}
