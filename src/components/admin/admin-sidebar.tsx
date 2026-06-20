"use client";

import { useState } from "react";
import Link from "next/link";
import Image from "next/image";
import { usePathname } from "next/navigation";
import { signOut } from "next-auth/react";
import {
  LayoutDashboard,
  Package,
  Users,
  ClipboardList,
  FileText,
  Settings,
  LogOut,
  Menu,
  X,
  ShieldCheck,
  Truck,
  ShoppingCart,
  PackageCheck,
  UserSearch,
  Kanban,
  UserCog,
} from "lucide-react";
import { Spinner } from "@/components/ui/spinner";
import { cn } from "@/lib/utils";

const navItems = [
  { icon: LayoutDashboard, label: "Dashboard", href: "/admin/dashboard" },
  { icon: Package, label: "Products", href: "/admin/products" },
  { icon: Users, label: "Dealers", href: "/admin/dealers" },
  { icon: ClipboardList, label: "Orders", href: "/admin/orders" },
  { icon: FileText, label: "Invoices", href: "/admin/invoices" },
  { icon: Truck, label: "Vendors", href: "/admin/vendors" },
];
const procurementItems = [
  { icon: ClipboardList, label: "Requests", href: "/admin/procurement/requests" },
  { icon: ShoppingCart, label: "Purchase Orders", href: "/admin/procurement/purchase-orders" },
  { icon: PackageCheck, label: "GRN", href: "/admin/procurement/grn" },
];
const crmItems = [
  { icon: UserSearch, label: "Leads", href: "/admin/crm/leads" },
  { icon: Kanban, label: "Pipeline", href: "/admin/crm/pipeline" },
];
const superAdminItems = [
  { icon: ShieldCheck, label: "Admins", href: "/admin/admins" },
  { icon: Settings, label: "Settings", href: "/admin/settings" },
];

const ICON_MAP: Record<string, any> = {
  "/admin/dashboard": LayoutDashboard,
  "/admin/dealers": Users,
  "/admin/orders": ClipboardList,
  "/admin/crm/leads": UserSearch,
  "/admin/crm/pipeline": Kanban,
  "/admin/products": Package,
  "/admin/procurement/grn": PackageCheck,
  "/admin/invoices": FileText,
};

const STAFF_NAV: Record<string, { label: string; href: string }[]> = {
  SALES: [
    { label: "Dashboard", href: "/admin/dashboard" },
    { label: "Dealers", href: "/admin/dealers" },
    { label: "Orders", href: "/admin/orders" },
    { label: "Leads", href: "/admin/crm/leads" },
    { label: "Pipeline", href: "/admin/crm/pipeline" },
  ],
  MARKETING: [
    { label: "Dashboard", href: "/admin/dashboard" },
    { label: "Products", href: "/admin/products" },
    { label: "Leads", href: "/admin/crm/leads" },
    { label: "Pipeline", href: "/admin/crm/pipeline" },
  ],
  PRODUCTION: [
    { label: "Dashboard", href: "/admin/dashboard" },
    { label: "Orders", href: "/admin/orders" },
    { label: "Products", href: "/admin/products" },
    { label: "GRN", href: "/admin/procurement/grn" },
  ],
  ACCOUNTS: [
    { label: "Dashboard", href: "/admin/dashboard" },
    { label: "Orders", href: "/admin/orders" },
    { label: "Invoices", href: "/admin/invoices" },
  ],
};

const DEPT_COLORS: Record<string, string> = {
  SALES: "text-blue-400",
  MARKETING: "text-purple-400",
  PRODUCTION: "text-orange-400",
  ACCOUNTS: "text-green-400",
};
const DEPT_BG: Record<string, string> = {
  SALES: "bg-blue-500/10",
  MARKETING: "bg-purple-500/10",
  PRODUCTION: "bg-orange-500/10",
  ACCOUNTS: "bg-green-500/10",
};

interface Props {
  user: {
    name?: string | null;
    email?: string | null;
    role: string;
    isSuperAdmin?: boolean;
    department?: string | null;
  };
}

function NavSectionLabel({ children }: { children: React.ReactNode }) {
  return (
    <div className="flex items-center gap-2 px-3 pt-5 pb-2">
      <div className="h-px flex-1 bg-[var(--border-color)]" />
      <span className="text-[var(--text-muted)] text-[10px] uppercase tracking-widest font-semibold whitespace-nowrap">{children}</span>
      <div className="h-px flex-1 bg-[var(--border-color)]" />
    </div>
  );
}

export function AdminSidebar({ user }: Props) {
  const pathname = usePathname();
  const [mobileOpen, setMobileOpen] = useState(false);
  const [signingOut, setSigningOut] = useState(false);

  const handleSignOut = async () => {
    setSigningOut(true);
    await signOut({ callbackUrl: "/" });
  };
  const isStaff = user.role === "STAFF";
  const staffNav = isStaff ? (STAFF_NAV[user.department || ""] ?? []) : [];

  const navLink = (href: string, label: string, Icon: any) => {
    const isActive = pathname === href || (href !== "/admin/dashboard" && pathname.startsWith(href));
    return (
      <Link
        key={href}
        href={href}
        onClick={() => setMobileOpen(false)}
        className={cn(
          "flex items-center gap-3 px-3 py-2.5 rounded-xl text-sm font-medium transition-all duration-200",
          isActive
            ? "bg-red-600/12 text-red-500 shadow-[inset_0_0_0_1px_rgba(220,38,38,0.2)]"
            : "text-[var(--text-muted)] hover:text-[var(--text-primary)] hover:bg-[var(--bg-card-hover)]"
        )}
      >
        <Icon
          size={17}
          className={cn(
            "flex-shrink-0 transition-colors",
            isActive ? "text-red-500" : "text-[var(--text-muted)]"
          )}
        />
        <span>{label}</span>
        {isActive && <div className="ml-auto w-1.5 h-1.5 bg-red-500 rounded-full" />}
      </Link>
    );
  };

  const SidebarContent = () => (
    <div className="flex flex-col h-full">
      {/* Logo */}
      <div className="p-5 border-b border-[var(--border-color)]">
        <Link href="/" className="flex flex-col items-center gap-2.5 text-center">
          <Image src="/motoxplus/logo.png" alt="MOTOXPLUS" width={60} height={60} className="object-contain" />
          <div>
            <div className="text-[var(--text-primary)] font-black text-sm tracking-wide leading-tight">
              MOTOX<span className="text-red-500">PLUS</span>
            </div>
            <div className="text-[var(--text-muted)] text-[9px] leading-tight">India Private Limited</div>
            <div className="text-red-600 text-[9px] uppercase tracking-widest mt-1 font-bold">
              {isStaff ? `${user.department} Portal` : user.isSuperAdmin ? "Super Admin" : "Admin Panel"}
            </div>
          </div>
        </Link>
      </div>

      {/* User badge */}
      <div className="px-4 pt-4 pb-2">
        <div className="glass border border-[var(--border-color)] rounded-xl p-3">
          <div className="flex items-center gap-2.5">
            <div className="w-8 h-8 rounded-lg bg-red-600/15 border border-red-600/20 flex items-center justify-center flex-shrink-0">
              <span className="text-red-500 font-black text-xs">
                {(user.name || "A").charAt(0).toUpperCase()}
              </span>
            </div>
            <div className="min-w-0 flex-1">
              <div className="text-[var(--text-primary)] font-semibold text-xs truncate">{user.name}</div>
              <div className="text-[var(--text-muted)] text-[10px] truncate">{user.email}</div>
            </div>
          </div>
          <div className="mt-2 flex">
            {isStaff ? (
              <span className={`text-[10px] uppercase tracking-widest font-bold px-2 py-0.5 rounded-full ${DEPT_COLORS[user.department || "SALES"]} ${DEPT_BG[user.department || "SALES"]}`}>
                {user.department}
              </span>
            ) : (
              <span className={`text-[10px] uppercase tracking-widest font-bold px-2 py-0.5 rounded-full ${user.isSuperAdmin ? "text-red-400 bg-red-500/10" : "text-blue-400 bg-blue-500/10"}`}>
                {user.isSuperAdmin ? "Super Admin" : "Admin"}
              </span>
            )}
          </div>
        </div>
      </div>

      {/* Nav */}
      <nav className="flex-1 px-3 overflow-y-auto min-h-0 py-2">
        {isStaff ? (
          staffNav.map((item) => {
            const Icon = ICON_MAP[item.href] || LayoutDashboard;
            return navLink(item.href, item.label, Icon);
          })
        ) : (
          <>
            {navItems.map((item) => navLink(item.href, item.label, item.icon))}

            <NavSectionLabel>Procurement</NavSectionLabel>
            {procurementItems.map((item) => navLink(item.href, item.label, item.icon))}

            <NavSectionLabel>CRM</NavSectionLabel>
            {crmItems.map((item) => navLink(item.href, item.label, item.icon))}

            <NavSectionLabel>Team</NavSectionLabel>
            {navLink("/admin/staff", "Staff Accounts", UserCog)}

            {user.isSuperAdmin && (
              <>
                <NavSectionLabel>Super Admin</NavSectionLabel>
                {superAdminItems.map((item) => navLink(item.href, item.label, item.icon))}
              </>
            )}
          </>
        )}
      </nav>

      {/* Logout */}
      <div className="p-3 border-t border-[var(--border-color)]">
        <button
          onClick={handleSignOut}
          disabled={signingOut}
          className="flex items-center gap-3 w-full px-3 py-2.5 text-[var(--text-muted)] hover:text-red-500 hover:bg-red-900/10 rounded-xl text-sm font-medium transition-all disabled:opacity-60"
        >
          {signingOut ? <Spinner size={17} className="text-red-500" /> : <LogOut size={17} />}
          {signingOut ? "Signing out..." : "Sign Out"}
        </button>
      </div>
    </div>
  );

  return (
    <>
      <aside className="hidden md:flex fixed left-0 top-0 bottom-0 w-64 bg-[var(--bg-secondary)] border-r border-[var(--border-color)] flex-col z-40">
        <SidebarContent />
      </aside>

      <button
        onClick={() => setMobileOpen(true)}
        className="md:hidden fixed top-4 left-4 z-50 glass border border-[var(--border-color)] p-2 rounded-xl"
      >
        <Menu size={20} className="text-[var(--text-primary)]" />
      </button>

      {mobileOpen && (
        <div className="md:hidden fixed inset-0 z-50 flex">
          <div className="fixed inset-0 bg-black/60 backdrop-blur-sm animate-fade-in" onClick={() => setMobileOpen(false)} />
          <aside className="relative w-64 bg-[var(--bg-secondary)] border-r border-[var(--border-color)] flex flex-col z-10 animate-slide-in-left">
            <button onClick={() => setMobileOpen(false)} className="absolute top-4 right-4 text-[var(--text-muted)] hover:text-[var(--text-primary)] p-1">
              <X size={20} />
            </button>
            <SidebarContent />
          </aside>
        </div>
      )}
    </>
  );
}
