import { prisma } from "@/lib/prisma";
import { formatDate } from "@/lib/utils";
import Link from "next/link";
import { Plus, Users } from "lucide-react";
import { StaffActions } from "./staff-actions";

const DEPT_COLORS: Record<string, string> = {
  SALES: "bg-blue-900/20 text-blue-400",
  MARKETING: "bg-purple-900/20 text-purple-400",
  PRODUCTION: "bg-orange-900/20 text-orange-400",
  ACCOUNTS: "bg-green-900/20 text-green-400",
};

const DEPT_SECTIONS: Record<string, string> = {
  SALES: "CRM · Dealers · Orders",
  MARKETING: "Products · CRM",
  PRODUCTION: "Orders · Products · GRN",
  ACCOUNTS: "Orders · Invoices",
};

export default async function StaffPage() {
  const staff = await prisma.user.findMany({
    where: { role: "STAFF" },
    select: { id: true, name: true, email: true, department: true, createdAt: true },
    orderBy: { createdAt: "desc" },
  });

  const byDept = {
    SALES: staff.filter((s) => s.department === "SALES").length,
    MARKETING: staff.filter((s) => s.department === "MARKETING").length,
    PRODUCTION: staff.filter((s) => s.department === "PRODUCTION").length,
    ACCOUNTS: staff.filter((s) => s.department === "ACCOUNTS").length,
  };

  return (
    <div>
      <div className="mb-8 flex items-center justify-between">
        <div>
          <h1 className="text-3xl font-black text-[var(--text-primary)] tracking-tight">Staff Accounts</h1>
          <p className="text-[var(--text-muted)] mt-1">{staff.length} staff member{staff.length !== 1 ? "s" : ""} across all departments</p>
        </div>
        <Link
          href="/admin/staff/new"
          className="flex items-center gap-2 bg-red-600 hover:bg-red-700 text-white font-bold px-4 py-2.5 rounded-sm text-sm transition-colors uppercase tracking-wider"
        >
          <Plus size={16} /> Add Staff
        </Link>
      </div>

      {/* Dept stats */}
      <div className="grid grid-cols-2 md:grid-cols-4 gap-4 mb-8">
        {(["SALES", "MARKETING", "PRODUCTION", "ACCOUNTS"] as const).map((dept) => (
          <div key={dept} className="glass border border-[var(--border-color)] rounded-sm p-4">
            <div className={`text-xs font-bold uppercase tracking-widest px-2 py-1 rounded-sm inline-block mb-2 ${DEPT_COLORS[dept]}`}>{dept}</div>
            <div className="text-2xl font-black text-[var(--text-primary)]">{byDept[dept]}</div>
            <div className="text-[var(--text-muted)] text-xs mt-1">{DEPT_SECTIONS[dept]}</div>
          </div>
        ))}
      </div>

      {staff.length === 0 ? (
        <div className="glass border border-[var(--border-color)] rounded-sm p-16 text-center">
          <Users size={40} className="text-gray-700 mx-auto mb-4" />
          <p className="text-[var(--text-muted)]">No staff accounts yet. Add your first staff member.</p>
          <Link href="/admin/staff/new" className="mt-4 inline-block bg-red-600 hover:bg-red-700 text-white font-bold px-6 py-2.5 rounded-sm text-sm uppercase tracking-wider transition-colors">
            Add Staff
          </Link>
        </div>
      ) : (
        <div className="glass border border-[var(--border-color)] rounded-sm overflow-hidden">
          <table className="w-full">
            <thead>
              <tr className="border-b border-[var(--border-color)]">
                <th className="px-4 py-3 text-left text-xs text-[var(--text-muted)] uppercase tracking-widest">Name</th>
                <th className="px-4 py-3 text-left text-xs text-[var(--text-muted)] uppercase tracking-widest hidden md:table-cell">Email</th>
                <th className="px-4 py-3 text-left text-xs text-[var(--text-muted)] uppercase tracking-widest">Department</th>
                <th className="px-4 py-3 text-left text-xs text-[var(--text-muted)] uppercase tracking-widest hidden lg:table-cell">Access</th>
                <th className="px-4 py-3 text-left text-xs text-[var(--text-muted)] uppercase tracking-widest hidden md:table-cell">Added</th>
                <th className="px-4 py-3 text-right text-xs text-[var(--text-muted)] uppercase tracking-widest">Actions</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-white/5">
              {staff.map((member) => (
                <tr key={member.id} className="hover:bg-white/2 transition-colors">
                  <td className="px-4 py-4">
                    <p className="text-[var(--text-primary)] font-bold text-sm">{member.name}</p>
                  </td>
                  <td className="px-4 py-4 hidden md:table-cell">
                    <p className="text-[var(--text-muted)] text-sm">{member.email}</p>
                  </td>
                  <td className="px-4 py-4">
                    <span className={`text-xs font-bold uppercase tracking-wider px-2 py-1 rounded-sm ${DEPT_COLORS[member.department || "SALES"]}`}>
                      {member.department}
                    </span>
                  </td>
                  <td className="px-4 py-4 hidden lg:table-cell">
                    <p className="text-[var(--text-muted)] text-xs">{DEPT_SECTIONS[member.department || "SALES"]}</p>
                  </td>
                  <td className="px-4 py-4 hidden md:table-cell">
                    <p className="text-[var(--text-muted)] text-xs">{formatDate(member.createdAt)}</p>
                  </td>
                  <td className="px-4 py-4 text-right">
                    <StaffActions id={member.id} name={member.name || ""} />
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
