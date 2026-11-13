import type { Metadata } from "next";
import { Suspense } from "react";
import { AuthPageLayout, AuthCardSkeleton } from "@/components/auth/auth-page-layout";
import { VerifyMobileForm } from "@/components/auth/verify-mobile-form";

export const metadata: Metadata = {
  title: "Verify Mobile — MOTOXPLUS India",
};

export default function VerifyMobilePage() {
  return (
    <AuthPageLayout>
      <Suspense fallback={<AuthCardSkeleton rows={1} />}>
        <VerifyMobileForm />
      </Suspense>
    </AuthPageLayout>
  );
}
