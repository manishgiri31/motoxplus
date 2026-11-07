import Link from "next/link";
import { Container } from "@/components/store/container";
import { Button } from "@/components/ui/button";
import { START_SELLING_HREF } from "@/lib/seller/config";
import { ctaClass } from "./styles";

export function VendorCTA() {
  return (
    <section aria-labelledby="cta-title" className="border-t-4 border-mx-red bg-mx-black py-[clamp(56px,8vw,104px)] text-white">
      <Container className="grid gap-8 bp-lg:grid-cols-[minmax(0,8fr)_minmax(0,4fr)] bp-lg:items-end">
        <div>
          <h2 id="cta-title" className="max-w-[20ch] font-grotesk text-[clamp(32px,5vw,58px)] font-semibold leading-[1.04] tracking-[-0.03em]">
            Your products. More buyers. Bigger opportunities.
          </h2>
          <p className="mt-5 max-w-[52ch] text-[18px] leading-relaxed text-white/70">
            Join the MotoXPlus marketplace and take your automotive spare-parts business to the next level.
          </p>
        </div>
        <div className="flex flex-col items-start gap-4 bp-lg:items-end">
          <Button asChild size="lg" className={ctaClass}>
            <a href={START_SELLING_HREF}>Start selling</a>
          </Button>
          <p className="text-[14px] text-white/70">
            Already registered?{" "}
            <Link href="/login?callbackUrl=%2Fvendor%2Fdashboard" className="font-semibold text-white underline underline-offset-4 hover:text-mx-silver">
              Login to your Vendor Dashboard
            </Link>
            .
          </p>
        </div>
      </Container>
    </section>
  );
}
