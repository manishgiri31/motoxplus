import { Navbar } from "@/components/layout/navbar";
import { Footer } from "@/components/layout/footer";
import { HeroSection } from "@/components/home/hero-section";
import { TrustStrip } from "@/components/home/trust-strip";
import { CategoriesSection } from "@/components/home/categories-section";
import { WhyMotoXPlus } from "@/components/home/why-motoxplus";
import { ManufacturingSection } from "@/components/home/manufacturing-section";
import { DealerProgram } from "@/components/home/dealer-program";
import { ContactSection } from "@/components/home/contact-section";
import { prisma } from "@/lib/prisma";

export default async function HomePage() {
  const [productCount, categoryCount, topCategories] = await Promise.all([
    prisma.product.count({ where: { isActive: true } }),
    prisma.category.count({ where: { isActive: true } }),
    prisma.category.findMany({
      where: { isActive: true },
      select: { slug: true, _count: { select: { products: { where: { isActive: true } } } } },
    }),
  ]);

  const categoryCounts = Object.fromEntries(
    topCategories.map((c) => [c.slug, c._count.products])
  );

  return (
    <>
      <Navbar />
      <main>
        <HeroSection productCount={productCount} categoryCount={categoryCount} />
        <TrustStrip />
        <CategoriesSection categoryCounts={categoryCounts} />
        <WhyMotoXPlus />
        <ManufacturingSection />
        <DealerProgram />
        <ContactSection />
      </main>
      <Footer />
    </>
  );
}
