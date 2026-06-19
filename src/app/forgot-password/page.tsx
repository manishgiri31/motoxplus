import type { Metadata } from "next";
import { Suspense } from "react";
import { AuthPageLayout } from "@/components/auth/auth-page-layout";
import { ForgotPasswordForm } from "@/components/auth/forgot-password-form";

export const metadata: Metadata = {
  title: "Forgot Password — MOTOXPLUS India",
};

export default function ForgotPasswordPage() {
  return (
    <AuthPageLayout>
      <Suspense fallback={<div className="glass border border-[var(--border-color)] rounded-sm p-8 animate-pulse h-64" />}>
        <ForgotPasswordForm />
      </Suspense>
    </AuthPageLayout>
  );
}
