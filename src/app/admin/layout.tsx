import { getServerSession } from "next-auth";
import { redirect } from "next/navigation";
import { authOptions } from "@/lib/auth";
import { AdminSidebar } from "@/components/admin/admin-sidebar";

export default async function AdminLayout({ children }: { children: React.ReactNode }) {
  const session = await getServerSession(authOptions);

  if (!session) redirect("/login");
  if (!["ADMIN", "SUPER_ADMIN"].includes(session.user.role)) {
    redirect("/dealer/dashboard");
  }

  return (
    <div className="min-h-screen bg-[var(--bg-primary)] flex">
      <AdminSidebar user={session.user} />
      <main className="flex-1 ml-0 md:ml-64 min-h-screen">
        <div className="p-4 md:p-8">{children}</div>
      </main>
    </div>
  );
}
