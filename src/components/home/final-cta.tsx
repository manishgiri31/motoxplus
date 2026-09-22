import Link from "next/link";
import { ArrowRight } from "lucide-react";
import { MediaHero } from "@/components/ui/media-hero";
import { Button } from "@/components/ui/button";

/** Section 13 — closing cinematic bookend, reusing MediaHero (same component,
 *  same footage as the opening hero) rather than a one-off variant. */
export function FinalCta() {
  return (
    <MediaHero
      media="home.hero.primary"
      align="center"
      headline={
        <>
          Your next supply partner
          <br />
          <span className="text-[var(--red)]">starts here.</span>
        </>
      }
      description="Become a MotoXPlus dealer, or explore the range built to spec for India's roads."
      actions={
        <>
          <Button asChild variant="brand" size="lg">
            <Link href="/become-dealer" className="group">
              Become a Dealer
              <ArrowRight size={16} className="transition-transform group-hover:translate-x-0.5" />
            </Link>
          </Button>
          <Button asChild variant="ghost" size="lg" className="border-white/30 text-white hover:border-white hover:bg-white/10">
            <Link href="/products">Explore Products</Link>
          </Button>
        </>
      }
      className="min-h-[80svh]"
    />
  );
}
