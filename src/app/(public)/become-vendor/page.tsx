import type { Metadata } from "next";
import { JsonLd } from "@/components/seo/json-ld";
import { FAQS } from "@/components/become-vendor/content";
import { spaceGrotesk } from "@/components/become-vendor/fonts";
import { VendorBenefits } from "@/components/become-vendor/vendor-benefits";
import { VendorCTA } from "@/components/become-vendor/vendor-cta";
import { VendorFAQ } from "@/components/become-vendor/vendor-faq";
import { VendorHero } from "@/components/become-vendor/vendor-hero";
import { VendorHowItWorks } from "@/components/become-vendor/vendor-how-it-works";
import { VendorTransparency } from "@/components/become-vendor/vendor-transparency";
import { VendorTypes } from "@/components/become-vendor/vendor-types";

export const metadata: Metadata = {
  title: "Sell on MotoXPlus | Become a Vendor",
  description:
    "Manufacturers, wholesalers, distributors and spare-parts suppliers: register on MotoXPlus, list your products and sell to dealers, retailers, workshops and customers across India. MotoXPlus arranges shipping.",
  alternates: { canonical: "/become-vendor" },
  openGraph: {
    title: "Sell on MotoXPlus",
    description: "List your two-wheeler spare parts and sell to dealers and customers across India.",
    url: "/become-vendor",
  },
};

export default function BecomeVendorPage() {
  return (
    // `mx-seller` re-points the shared controls (buttons, inputs, focus rings) at the marketplace red.
    <div className={`mx-seller ${spaceGrotesk.variable} font-body text-mx-black`}>
      <JsonLd
        data={{
          "@context": "https://schema.org",
          "@type": "FAQPage",
          mainEntity: FAQS.map((f) => ({
            "@type": "Question",
            name: f.q,
            acceptedAnswer: { "@type": "Answer", text: f.a },
          })),
        }}
      />
      <VendorHero />
      <VendorBenefits />
      <VendorTypes />
      <VendorHowItWorks />
      <VendorTransparency />
      <VendorFAQ />
      <VendorCTA />
    </div>
  );
}
