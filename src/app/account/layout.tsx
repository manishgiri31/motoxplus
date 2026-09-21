import { getServerSession } from "next-auth";
import { redirect } from "next/navigation";
import { authOptions } from "@/lib/auth";
import { AccountSidebar } from "@/components/account/account-sidebar";

export default async function AccountLayout({ children }: { children: React.ReactNode }) {
  const session = await getServerSession(authOptions);

  if (!session) redirect("/login?as=customer");
  if (session.user.role !== "CUSTOMER") redirect("/login");

  return (
    <div className="min-h-screen bg-[var(--bg-primary)] flex">
      <AccountSidebar user={session.user} />
      <main className="flex-1 ml-0 md:ml-64 min-h-screen">
        <div className="p-4 md:p-8">{children}</div>
      </main>
    </div>
  );
}
