import { Navbar } from "@/components/layout/navbar";
import { Footer } from "@/components/layout/footer";
import { HeroSection } from "@/components/home/hero-section";
import { TrustStrip } from "@/components/home/trust-strip";
import { CategoriesSection } from "@/components/home/categories-section";
import { WhyMotoXPlus } from "@/components/home/why-motoxplus";
import { ManufacturingSection } from "@/components/home/manufacturing-section";
import { DealerProgram } from "@/components/home/dealer-program";
import { ContactSection } from "@/components/home/contact-section";

export default function HomePage() {
  return (
    <>
      <Navbar />
      <main>
        <HeroSection />
        <TrustStrip />
        <CategoriesSection />
        <WhyMotoXPlus />
        <ManufacturingSection />
        <DealerProgram />
        <ContactSection />
      </main>
      <Footer />
    </>
  );
}
