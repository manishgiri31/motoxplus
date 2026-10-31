import type { Metadata } from "next";
import { Suspense } from "react";
import { AuthPageLayout, AuthCardSkeleton } from "@/components/auth/auth-page-layout";
import { RegisterForm } from "@/components/auth/register-form";

export const metadata: Metadata = {
  title: "Dealer Registration — MOTOXPLUS India",
  description: "Apply to become an authorised MOTOXPLUS dealer.",
};

export default function RegisterPage() {
  return (
    <AuthPageLayout>
      <Suspense fallback={<AuthCardSkeleton rows={3} />}>
        <RegisterForm />
      </Suspense>
    </AuthPageLayout>
  );
}
