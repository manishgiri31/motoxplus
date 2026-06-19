import type { Metadata } from "next";
import { Suspense } from "react";
import { AuthPageLayout } from "@/components/auth/auth-page-layout";
import { VerifyMobileForm } from "@/components/auth/verify-mobile-form";

export const metadata: Metadata = {
  title: "Verify Mobile — MOTOXPLUS India",
};

export default function VerifyMobilePage() {
  return (
    <AuthPageLayout>
      <Suspense fallback={<div className="glass border border-[var(--border-color)] rounded-sm p-8 animate-pulse h-64" />}>
        <VerifyMobileForm />
      </Suspense>
    </AuthPageLayout>
  );
}
