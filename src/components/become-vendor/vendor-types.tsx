import { Container } from "@/components/store/container";
import { PART_CATEGORY_LIST, VEHICLE_BRAND_LIST, VENDOR_TYPES } from "./content";
import { SectionHeading } from "./section-heading";

function Index({ title, items }: { title: string; items: readonly string[] }) {
  return (
    <div>
      <h3 className="font-grotesk text-[12px] font-semibold uppercase tracking-[0.16em] text-white/60">{title}</h3>
      <ul className="mt-3 border-t border-white/15">
        {items.map((item) => (
          <li key={item} className="flex items-center gap-3 border-b border-white/15 py-3 text-[16px] text-white">
            <span aria-hidden className="size-1.5 shrink-0 bg-mx-red" />
            {item}
          </li>
        ))}
      </ul>
    </div>
  );
}

/** Who can sell (VendorTypes) + what they can list (ProductCategories), as one dark catalogue-index band. */
export function VendorTypes() {
  return (
    <section aria-labelledby="types-title" className="bg-mx-black py-[clamp(56px,8vw,112px)] text-white">
      <Container className="grid gap-14 bp-lg:grid-cols-2 bp-lg:gap-20">
        <div>
          <SectionHeading
            index="02"
            eyebrow="Who can sell"
            title="Who can become a MotoXPlus vendor?"
            id="types-title"
            invert
          />
          <ul className="mt-10 border-t border-white/15">
            {VENDOR_TYPES.map((t) => (
              <li key={t.name} className="grid gap-1 border-b border-white/15 py-5 sm:grid-cols-[minmax(0,13rem)_1fr] sm:gap-6">
                <h3 className="font-grotesk text-[22px] font-semibold tracking-[-0.01em]">{t.name}</h3>
                <p className="text-[16px] leading-relaxed text-white/70">{t.body}</p>
              </li>
            ))}
          </ul>
        </div>

        <div>
          <p className="font-grotesk text-[13px] font-semibold uppercase tracking-[0.18em] text-white/60">
            What you can list
          </p>
          <div className="mt-6 grid gap-10 sm:grid-cols-2">
            <Index title="Vehicle brands" items={VEHICLE_BRAND_LIST} />
            <Index title="Part categories" items={PART_CATEGORY_LIST} />
          </div>
          <p className="mt-8 max-w-[52ch] text-[15px] leading-relaxed text-white/70">
            Supply something that is not listed? Choose &ldquo;Other Automotive Parts&rdquo; when you register. Categories are managed by
            MotoXPlus and added as the catalogue grows.
          </p>
        </div>
      </Container>
    </section>
  );
}
