import type { Metadata } from "next";
import { Suspense } from "react";
import { AuthPageLayout, AuthCardSkeleton } from "@/components/auth/auth-page-layout";
import { ResetPasswordForm } from "@/components/auth/reset-password-form";

export const metadata: Metadata = {
  title: "Reset Password — MOTOXPLUS India",
};

export default function ResetPasswordPage() {
  return (
    <AuthPageLayout>
      <Suspense fallback={<AuthCardSkeleton rows={2} />}>
        <ResetPasswordForm />
      </Suspense>
    </AuthPageLayout>
  );
}
