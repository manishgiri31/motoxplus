import { getServerSession } from "next-auth";
import { redirect } from "next/navigation";
import { authOptions } from "@/lib/auth";
import { AdminSidebar } from "@/components/admin/admin-sidebar";
import { PortalShell } from "@/components/portal/portal-shell";

export default async function AdminLayout({ children }: { children: React.ReactNode }) {
  const session = await getServerSession(authOptions);

  const INTERNAL_ROLES = ["ADMIN", "SUPER_ADMIN", "STAFF"];

  if (!session) redirect("/login");
  if (!INTERNAL_ROLES.includes(session.user.role)) {
    if (session.user.role === "VENDOR") redirect("/vendor/dashboard");
    redirect("/dealer/dashboard");
  }

  return <PortalShell sidebar={<AdminSidebar user={session.user} />}>{children}</PortalShell>;
}
