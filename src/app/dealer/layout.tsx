import { getServerSession } from "next-auth";
import { redirect } from "next/navigation";
import { authOptions } from "@/lib/auth";
import { DealerSidebar } from "@/components/dealer/dealer-sidebar";

export default async function DealerLayout({ children }: { children: React.ReactNode }) {
  const session = await getServerSession(authOptions);

  if (!session) redirect("/login");
  if (session.user.role !== "DEALER") redirect("/admin/dashboard");

  return (
    <div className="min-h-screen bg-[var(--bg-primary)] flex">
      <DealerSidebar user={session.user} />
      <main className="flex-1 ml-0 md:ml-64 min-h-screen">
        <div className="p-4 md:p-8">{children}</div>
      </main>
    </div>
  );
}
