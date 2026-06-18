import { getServerSession } from "next-auth";
import { redirect } from "next/navigation";
import { authOptions } from "@/lib/auth";
import { VendorSidebar } from "@/components/vendor/vendor-sidebar";

export default async function VendorLayout({ children }: { children: React.ReactNode }) {
  const session = await getServerSession(authOptions);

  if (!session) redirect("/login");
  if (session.user.role !== "VENDOR") redirect("/");

  return (
    <div className="min-h-screen bg-[var(--bg-primary)] flex">
      <VendorSidebar user={session.user} />
      <main className="flex-1 ml-0 md:ml-64 min-h-screen">
        <div className="p-4 md:p-8">{children}</div>
      </main>
    </div>
  );
}
