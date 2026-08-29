import type { Metadata } from "next";
import { getServerSession } from "next-auth";
import { redirect } from "next/navigation";
import { authOptions } from "@/lib/auth";
import { AuthPageLayout } from "@/components/auth/auth-page-layout";
import { PendingApprovalCard } from "@/components/auth/pending-approval-card";

export const metadata: Metadata = {
  title: "Application Under Review — MOTOXPLUS India",
};

export default async function PendingApprovalPage() {
  const session = await getServerSession(authOptions);
  if (!session) redirect("/login");

  const role = session.user.role;
  const status = role === "VENDOR" ? session.user.vendorStatus : session.user.dealerStatus;

  // Dealers no longer wait for approval — only a suspended/rejected dealer belongs
  // here. An in-good-standing dealer or an approved vendor goes to their portal.
  if (role === "DEALER" && status !== "SUSPENDED" && status !== "REJECTED") {
    redirect("/dealer/dashboard");
  }
  if (role === "VENDOR" && status === "APPROVED") {
    redirect("/vendor/dashboard");
  }

  return (
    <AuthPageLayout>
      <PendingApprovalCard role={role} status={status} />
    </AuthPageLayout>
  );
}
