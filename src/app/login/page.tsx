import type { Metadata } from "next";
import { Suspense } from "react";
import { AuthPageLayout, AuthCardSkeleton } from "@/components/auth/auth-page-layout";
import { LoginModeSwitch } from "@/components/auth/login-mode-switch";

export const metadata: Metadata = {
  title: "Login",
  description: "Login to MotoXPlus India dealer, customer, or admin portal.",
};

export default function LoginPage() {
  return (
    <AuthPageLayout>
      <Suspense
        fallback={<AuthCardSkeleton rows={1} />}
      >
        <LoginModeSwitch />
      </Suspense>
    </AuthPageLayout>
  );
}
