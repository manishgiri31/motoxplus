import type { Metadata } from "next";
import { Suspense } from "react";
import { AuthPageLayout, AuthCardSkeleton } from "@/components/auth/auth-page-layout";
import { CustomerSignupForm } from "@/components/auth/customer-signup-form";

export const metadata: Metadata = {
  title: "Create account",
  description: "Create a MOTOXPLUS customer account to order genuine two-wheeler parts.",
};

const POINTS = [
  { title: "Verified once, then just sign in", body: "One code to confirm your mobile and email. After that, your password." },
  { title: "Checkout already filled in", body: "Your delivery address is saved, so ordering takes seconds." },
  { title: "Orders and invoices in one place", body: "Follow every order and download its GST invoice." },
];

// Customer (B2C) signup, its own route. Dealers apply at /register; everyone
// signs in at /login with mobile/email + password.
export default function SignupPage() {
  return (
    <AuthPageLayout heading="Genuine parts, delivered to your door." points={POINTS}>
      <Suspense fallback={<AuthCardSkeleton rows={4} />}>
        <CustomerSignupForm />
      </Suspense>
    </AuthPageLayout>
  );
}
