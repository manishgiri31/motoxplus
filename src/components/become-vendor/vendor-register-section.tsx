import { Container } from "@/components/store/container";
import { SELLER_SIGNUP_OPEN } from "@/lib/seller/config";
import { VendorRegistrationWizard } from "./registration-wizard";
import { SectionHeading } from "./section-heading";
import { SellerInterestForm } from "./seller-interest-form";

export function VendorRegisterSection() {
  return (
    <section id="register" aria-labelledby="register-title" className="scroll-mt-24 bg-white py-[clamp(56px,8vw,112px)]">
      <Container>
        <SectionHeading
          index="05"
          eyebrow="Register"
          title="Start selling on MotoXPlus"
          lead={
            SELLER_SIGNUP_OPEN
              ? "Five short steps: account, business, products, bank and warehouse, then documents. Nothing is saved in your browser, so finish in one sitting."
              : undefined
          }
          id="register-title"
        />
        <div className="mt-10">{SELLER_SIGNUP_OPEN ? <VendorRegistrationWizard /> : <div className="max-w-3xl"><SellerInterestForm /></div>}</div>
      </Container>
    </section>
  );
}
