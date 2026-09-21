import type { Metadata } from "next";
import { Suspense } from "react";
import { AuthPageLayout } from "@/components/auth/auth-page-layout";
import { LoginModeSwitch } from "@/components/auth/login-mode-switch";

export const metadata: Metadata = {
  title: "Login",
  description: "Login to MotoXPlus India dealer, customer, or admin portal.",
};

export default function LoginPage() {
  return (
    <AuthPageLayout>
      <Suspense
        fallback={<div className="bg-[var(--card)] border border-[var(--line)] p-8 animate-pulse h-64" />}
      >
        <LoginModeSwitch />
      </Suspense>
    </AuthPageLayout>
  );
}
