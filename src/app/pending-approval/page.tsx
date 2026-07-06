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

  return (
    <AuthPageLayout>
      <PendingApprovalCard role={role} status={status} />
    </AuthPageLayout>
  );
}
