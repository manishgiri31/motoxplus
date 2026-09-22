import Link from "next/link";
import { ArrowRight } from "lucide-react";
import { SectionIntro } from "@/components/ui/section-intro";
import { Button } from "@/components/ui/button";
import { DealerNetwork } from "@/components/dealer/dealer-network";
import { Reveal } from "@/components/ui/reveal";

export interface DealerNetworkSectionProps {
  dealerCount: number;
  stateCount: number;
}

/** Section 08 — the dealer network, presented as infrastructure, not a marketing badge. */
export function DealerNetworkSection({ dealerCount, stateCount }: DealerNetworkSectionProps) {
  return (
    <section className="border-t border-[var(--line)] bg-[var(--paper)] px-4 py-20 md:px-8 md:py-28">
      <div className="mx-auto grid max-w-7xl grid-cols-1 items-center gap-14 lg:grid-cols-2">
        <Reveal>
          <SectionIntro
            index="08"
            eyebrow="Dealer Network"
            headline={
              <>
                Built for a dealer network.
                <br />
                <span className="text-[var(--red)]">Delivered across India.</span>
              </>
            }
            description="MotoXPlus supplies a growing dealer network across India with dedicated pricing, ordering, payment and shipment tracking — one platform running the whole relationship."
          />
          <Button asChild variant="brand" size="lg" className="mt-8">
            <Link href="/become-dealer" className="group">
              Become a Dealer
              <ArrowRight size={16} className="transition-transform group-hover:translate-x-0.5" />
            </Link>
          </Button>
        </Reveal>

        <DealerNetwork stats={{ dealerCount, stateCount }} />
      </div>
    </section>
  );
}
