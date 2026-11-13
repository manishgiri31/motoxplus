import type { Metadata } from "next";
import { Suspense } from "react";
import { AuthPageLayout, AuthCardSkeleton } from "@/components/auth/auth-page-layout";
import { ForgotPasswordForm } from "@/components/auth/forgot-password-form";

export const metadata: Metadata = {
  title: "Forgot Password — MOTOXPLUS India",
};

export default function ForgotPasswordPage() {
  return (
    <AuthPageLayout>
      <Suspense fallback={<AuthCardSkeleton rows={1} />}>
        <ForgotPasswordForm />
      </Suspense>
    </AuthPageLayout>
  );
}
