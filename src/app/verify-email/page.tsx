import type { Metadata } from "next";
import { Suspense } from "react";
import { AuthPageLayout } from "@/components/auth/auth-page-layout";
import { VerifyEmailForm } from "@/components/auth/verify-email-form";

export const metadata: Metadata = {
  title: "Verify Email — MOTOXPLUS India",
};

export default function VerifyEmailPage() {
  return (
    <AuthPageLayout>
      <Suspense fallback={<div className="glass border border-[var(--border-color)] rounded-sm p-8 animate-pulse h-64" />}>
        <VerifyEmailForm />
      </Suspense>
    </AuthPageLayout>
  );
}
