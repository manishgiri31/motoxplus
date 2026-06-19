import type { Metadata } from "next";
import { Suspense } from "react";
import { AuthPageLayout } from "@/components/auth/auth-page-layout";
import { ResetPasswordForm } from "@/components/auth/reset-password-form";

export const metadata: Metadata = {
  title: "Reset Password — MOTOXPLUS India",
};

export default function ResetPasswordPage() {
  return (
    <AuthPageLayout>
      <Suspense fallback={<div className="glass border border-[var(--border-color)] rounded-sm p-8 animate-pulse h-64" />}>
        <ResetPasswordForm />
      </Suspense>
    </AuthPageLayout>
  );
}
