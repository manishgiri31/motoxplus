import type { Metadata } from "next";
import { Suspense } from "react";
import { AuthPageLayout, AuthCardSkeleton } from "@/components/auth/auth-page-layout";
import { LoginForm } from "@/components/auth/login-form";

export const metadata: Metadata = {
  title: "Sign in",
  description: "Sign in to your MOTOXPLUS account with your mobile number or email and password.",
};

// One sign-in for every account type; the role decides where you land.
export default function LoginPage() {
  return (
    <AuthPageLayout>
      <Suspense fallback={<AuthCardSkeleton rows={2} />}>
        <LoginForm />
      </Suspense>
    </AuthPageLayout>
  );
}
