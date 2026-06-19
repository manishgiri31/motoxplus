import type { Metadata } from "next";
import { Suspense } from "react";
import { AuthPageLayout } from "@/components/auth/auth-page-layout";
import { RegisterForm } from "@/components/auth/register-form";

export const metadata: Metadata = {
  title: "Dealer Registration — MOTOXPLUS India",
  description: "Apply to become an authorised MOTOXPLUS dealer.",
};

export default function RegisterPage() {
  return (
    <AuthPageLayout>
      <Suspense fallback={<div className="glass border border-[var(--border-color)] rounded-sm p-8 animate-pulse h-96" />}>
        <RegisterForm />
      </Suspense>
    </AuthPageLayout>
  );
}
