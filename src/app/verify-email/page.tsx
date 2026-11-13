import type { Metadata } from "next";
import { Suspense } from "react";
import { AuthPageLayout, AuthCardSkeleton } from "@/components/auth/auth-page-layout";
import { VerifyEmailForm } from "@/components/auth/verify-email-form";

export const metadata: Metadata = {
  title: "Verify Email — MOTOXPLUS India",
};

export default function VerifyEmailPage() {
  return (
    <AuthPageLayout>
      <Suspense fallback={<AuthCardSkeleton rows={1} />}>
        <VerifyEmailForm />
      </Suspense>
    </AuthPageLayout>
  );
}
