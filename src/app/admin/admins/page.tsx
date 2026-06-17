import { getServerSession } from "next-auth";
import { redirect } from "next/navigation";
import { authOptions } from "@/lib/auth";
import { prisma } from "@/lib/prisma";
import { formatDate } from "@/lib/utils";
import { AdminAdminActions } from "@/components/admin/admin-admin-actions";
import { ShieldCheck, ShieldOff } from "lucide-react";

export default async function AdminAdminsPage() {
  const session = await getServerSession(authOptions);
  if (!session || !session.user.isSuperAdmin) redirect("/admin/dashboard");

  const admins = await prisma.admin.findMany({
    include: { user: true },
    orderBy: { createdAt: "asc" },
  });

  // Users who could be promoted (not already admins, not dealers)
  const promotable = await prisma.user.findMany({
    where: {
      role: { in: ["ADMIN", "GUEST"] },
      admin: null,
    },
    orderBy: { createdAt: "desc" },
    take: 50,
  });

  return (
    <div className="space-y-8">
      <div>
        <h1 className="text-3xl font-black text-[var(--text-primary)] tracking-tight">Admins</h1>
        <p className="text-[var(--text-muted)] mt-1">{admins.length} admin account{admins.length !== 1 ? "s" : ""}</p>
      </div>

      {/* Current admins table */}
      <div className="glass border border-[var(--border-color)] rounded-sm overflow-hidden">
        <div className="px-4 py-3 border-b border-[var(--border-color)] flex items-center gap-2">
          <ShieldCheck className="w-4 h-4 text-red-500" />
          <span className="text-sm font-semibold text-[var(--text-primary)]">Admin Accounts</span>
        </div>
        <table className="w-full">
          <thead>
            <tr className="border-b border-[var(--border-color)]">
              <th className="px-4 py-3 text-left text-xs text-[var(--text-muted)] uppercase tracking-widest">Name</th>
              <th className="px-4 py-3 text-left text-xs text-[var(--text-muted)] uppercase tracking-widest hidden md:table-cell">Email</th>
              <th className="px-4 py-3 text-left text-xs text-[var(--text-muted)] uppercase tracking-widest">Level</th>
              <th className="px-4 py-3 text-left text-xs text-[var(--text-muted)] uppercase tracking-widest hidden md:table-cell">Added</th>
              <th className="px-4 py-3 text-left text-xs text-[var(--text-muted)] uppercase tracking-widest">Actions</th>
            </tr>
          </thead>
          <tbody className="divide-y divide-white/5">
            {admins.map((admin) => {
              const isSelf = admin.userId === session.user.id;
              return (
                <tr key={admin.id} className="hover:bg-white/2 transition-colors">
                  <td className="px-4 py-4">
                    <div className="text-[var(--text-primary)] font-semibold text-sm">
                      {admin.user.name || "—"}
                      {isSelf && (
                        <span className="ml-2 text-[10px] text-red-500 font-bold uppercase tracking-widest">You</span>
                      )}
                    </div>
                  </td>
                  <td className="px-4 py-4 hidden md:table-cell">
                    <span className="text-[var(--text-muted)] text-xs">{admin.user.email}</span>
                  </td>
                  <td className="px-4 py-4">
                    <span className={`text-xs font-semibold uppercase tracking-wider px-2 py-1 rounded-sm ${
                      admin.isSuperAdmin
                        ? "bg-red-900/30 text-red-400"
                        : "bg-blue-900/20 text-blue-400"
                    }`}>
                      {admin.isSuperAdmin ? "Super Admin" : "Admin"}
                    </span>
                  </td>
                  <td className="px-4 py-4 hidden md:table-cell">
                    <span className="text-[var(--text-muted)] text-xs">{formatDate(admin.createdAt)}</span>
                  </td>
                  <td className="px-4 py-4">
                    {!isSelf ? (
                      <AdminAdminActions
                        adminId={admin.id}
                        userId={admin.userId}
                        isSuperAdmin={admin.isSuperAdmin}
                      />
                    ) : (
                      <span className="text-[var(--text-muted)] text-xs">—</span>
                    )}
                  </td>
                </tr>
              );
            })}
          </tbody>
        </table>
      </div>

      {/* Promote user section */}
      {promotable.length > 0 && (
        <div className="glass border border-[var(--border-color)] rounded-sm overflow-hidden">
          <div className="px-4 py-3 border-b border-[var(--border-color)] flex items-center gap-2">
            <ShieldOff className="w-4 h-4 text-[var(--text-muted)]" />
            <span className="text-sm font-semibold text-[var(--text-primary)]">Promote to Admin</span>
            <span className="text-xs text-[var(--text-muted)] ml-1">— non-dealer users without admin access</span>
          </div>
          <table className="w-full">
            <thead>
              <tr className="border-b border-[var(--border-color)]">
                <th className="px-4 py-3 text-left text-xs text-[var(--text-muted)] uppercase tracking-widest">Name</th>
                <th className="px-4 py-3 text-left text-xs text-[var(--text-muted)] uppercase tracking-widest hidden md:table-cell">Email</th>
                <th className="px-4 py-3 text-left text-xs text-[var(--text-muted)] uppercase tracking-widest">Action</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-white/5">
              {promotable.map((user) => (
                <tr key={user.id} className="hover:bg-white/2 transition-colors">
                  <td className="px-4 py-4">
                    <div className="text-[var(--text-primary)] text-sm">{user.name || "—"}</div>
                  </td>
                  <td className="px-4 py-4 hidden md:table-cell">
                    <span className="text-[var(--text-muted)] text-xs">{user.email}</span>
                  </td>
                  <td className="px-4 py-4">
                    <AdminAdminActions userId={user.id} isPromotion />
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}
    </div>
  );
}
