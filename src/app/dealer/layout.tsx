import { getServerSession } from "next-auth";
import { redirect } from "next/navigation";
import { authOptions } from "@/lib/auth";
import { DealerSidebar } from "@/components/dealer/dealer-sidebar";
import { PortalShell } from "@/components/portal/portal-shell";

export default async function DealerLayout({ children }: { children: React.ReactNode }) {
  const session = await getServerSession(authOptions);

  if (!session) redirect("/login");
  if (session.user.role !== "DEALER") redirect("/admin/dashboard");

  return <PortalShell sidebar={<DealerSidebar user={session.user} />}>{children}</PortalShell>;
}
