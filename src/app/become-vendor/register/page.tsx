import type { Metadata } from "next";
import { redirect } from "next/navigation";
import { AuthPageLayout } from "@/components/auth/auth-page-layout";
import { VendorRegisterForm } from "@/components/vendor/onboarding/vendor-register-form";
import { SELLER_SIGNUP_OPEN } from "@/lib/seller/config";

export const metadata: Metadata = {
  title: "Create a vendor account | MotoXPlus",
  description: "Register as a MotoXPlus vendor: create your login, verify your email and mobile, then add your business details.",
  alternates: { canonical: "/become-vendor/register" },
};

const POINTS = [
  { title: "Reach dealers and riders", body: "List your parts for workshops, retailers and customers across India." },
  { title: "We arrange shipping", body: "Pack at your warehouse; MotoXPlus books the courier and pickup." },
  { title: "Approved straight away", body: "Verify your email and mobile and your vendor account is active. Finish your business profile to start selling." },
];

export default function VendorRegisterPage() {
  // Until the Java vendor API is deployed (NEXT_PUBLIC_SELLER_SIGNUP_OPEN), the landing page's interest form is the
  // only working way in; never show a form that can only fail.
  if (!SELLER_SIGNUP_OPEN) redirect("/become-vendor#register");
  return (
    <AuthPageLayout className="mx-seller" heading="Sell your spare parts on MotoXPlus." points={POINTS}>
      <VendorRegisterForm />
    </AuthPageLayout>
  );
}
