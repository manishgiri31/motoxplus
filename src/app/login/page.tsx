import type { Metadata } from "next";
import { Suspense } from "react";
import { AuthPageLayout } from "@/components/auth/auth-page-layout";
import { LoginForm } from "@/components/auth/login-form";

export const metadata: Metadata = {
  title: "Login",
  description: "Login to MotoXPlus India dealer or admin portal.",
};

export default function LoginPage() {
  return (
    <AuthPageLayout>
      <Suspense
        fallback={<div className="bg-[var(--card)] border border-[var(--line)] p-8 animate-pulse h-64" />}
      >
        <LoginForm />
      </Suspense>
    </AuthPageLayout>
  );
}
