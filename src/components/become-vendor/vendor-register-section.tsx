import { Container } from "@/components/store/container";
import { SectionHeading } from "./section-heading";
import { SellerInterestForm } from "./seller-interest-form";

/**
 * Shown on /become-vendor only while self-registration is closed (NEXT_PUBLIC_SELLER_SIGNUP_OPEN unset): a working
 * interest form instead of a signup that would fail. Once open, "Start selling" goes to /become-vendor/register.
 */
export function VendorRegisterSection() {
  return (
    <section id="register" aria-labelledby="register-title" className="scroll-mt-24 bg-white py-[clamp(56px,8vw,112px)]">
      <Container>
        <SectionHeading index="05" eyebrow="Register" title="Start selling on MotoXPlus" id="register-title" />
        <div className="mt-10 max-w-3xl">
          <SellerInterestForm />
        </div>
      </Container>
    </section>
  );
}
