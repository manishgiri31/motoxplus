import type { Metadata } from "next";
import { Suspense } from "react";
import { AuthPageLayout, AuthCardSkeleton } from "@/components/auth/auth-page-layout";
import { RegisterForm } from "@/components/auth/register-form";
import { getServerSession } from "next-auth";
import { redirect } from "next/navigation";
import { authOptions } from "@/lib/auth";

export const metadata: Metadata = {
  title: "Dealer Registration — MOTOXPLUS India",
  description: "Apply to become an authorised MOTOXPLUS dealer.",
};

export default async function RegisterPage() {
  // A signed-in vendor adds a dealer profile to the same login (/become-dealer) rather than registering again.
  const role = (await getServerSession(authOptions))?.user?.role;
  if (role === "VENDOR") redirect("/become-dealer");
  return (
    <AuthPageLayout>
      <Suspense fallback={<AuthCardSkeleton rows={3} />}>
        <RegisterForm />
      </Suspense>
    </AuthPageLayout>
  );
}
