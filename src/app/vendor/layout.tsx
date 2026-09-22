import { getServerSession } from "next-auth";
import { redirect } from "next/navigation";
import { authOptions } from "@/lib/auth";
import { VendorSidebar } from "@/components/vendor/vendor-sidebar";
import { PortalShell } from "@/components/portal/portal-shell";

export default async function VendorLayout({ children }: { children: React.ReactNode }) {
  const session = await getServerSession(authOptions);

  if (!session) redirect("/login");
  if (session.user.role !== "VENDOR") redirect("/");

  return <PortalShell sidebar={<VendorSidebar user={session.user} />}>{children}</PortalShell>;
}
