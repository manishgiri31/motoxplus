import Image from "next/image";
import Link from "next/link";
import { StoreButton } from "@/components/store/button";
import { Reveal } from "@/components/store/reveal";

export function Hero() {
  return (
    <section className="overflow-hidden bg-store-bg px-4 pt-14 text-center bp-md:pt-20">
      <Reveal>
        <h1 className="text-[clamp(40px,7vw,80px)] font-semibold leading-[1.05] tracking-[-0.015em]">
          Engineered for reliability.
        </h1>
        <p className="mx-auto mt-2 max-w-[22ch] text-[clamp(19px,2.4vw,28px)] leading-[1.17] bp-md:max-w-none">
          OEM-fit mudguards, visors and panels, made in India.
        </p>
        <div className="mt-6 flex flex-wrap items-center justify-center gap-x-6 gap-y-3">
          <StoreButton href="/products">Shop parts</StoreButton>
          <Link
            href="/become-dealer"
            className="rounded-sm text-17 text-store-link hover:underline focus-visible:outline-store-accent"
          >
            Become a dealer &rsaquo;
          </Link>
        </div>
      </Reveal>
      <Image
        src="/store/hero.svg"
        alt="Placeholder artwork: a mudguard, visor and tail panel"
        width={1400}
        height={460}
        priority
        unoptimized
        className="mx-auto mt-10 h-auto w-[min(100%,1000px)] bp-md:mt-12"
      />
    </section>
  );
}
