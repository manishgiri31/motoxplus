"use client";

import { useState } from "react";
import Link from "next/link";
import Image from "next/image";
import { usePathname } from "next/navigation";
import { signOut } from "next-auth/react";
import {
  LayoutDashboard,
  ClipboardList,
  FileText,
  CreditCard,
  User,
  LogOut,
  Menu,
  X,
  Truck,
} from "lucide-react";
import { cn } from "@/lib/utils";

const navItems = [
  { icon: LayoutDashboard, label: "Dashboard", href: "/vendor/dashboard" },
  { icon: ClipboardList, label: "Purchase Orders", href: "/vendor/purchase-orders" },
  { icon: FileText, label: "My Invoices", href: "/vendor/invoices" },
  { icon: CreditCard, label: "Payments", href: "/vendor/payments" },
  { icon: User, label: "My Profile", href: "/vendor/profile" },
];

interface Props {
  user: {
    name?: string | null;
    email?: string | null;
    vendorId?: string;
  };
}

export function VendorSidebar({ user }: Props) {
  const pathname = usePathname();
  const [mobileOpen, setMobileOpen] = useState(false);

  const SidebarContent = () => (
    <div className="flex flex-col h-full">
      <div className="p-6 border-b border-[var(--border-color)]">
        <Link href="/" className="flex flex-col items-center gap-3 text-center">
          <Image src="/motoxplus/logo.png" alt="MOTOXPLUS" width={64} height={64} className="object-contain" />
          <div>
            <div className="text-[var(--text-primary)] font-black text-base tracking-wide leading-tight">
              MOTOX<span className="text-red-500">PLUS</span>
            </div>
            <div className="text-[var(--text-muted)] text-[9px] leading-tight">India Private Limited</div>
            <div className="text-amber-500 text-[9px] uppercase tracking-widest mt-1 font-semibold flex items-center justify-center gap-1">
              <Truck size={8} />
              Vendor Portal
            </div>
          </div>
        </Link>
      </div>

      <div className="p-4 mx-4 my-4 glass border border-[var(--border-color)] rounded-sm">
        <div className="text-[var(--text-primary)] font-semibold text-sm truncate">{user.name}</div>
        <div className="text-[var(--text-muted)] text-xs truncate">{user.email}</div>
        <div className="mt-2 inline-flex items-center gap-1.5">
          <Truck size={10} className="text-amber-500" />
          <span className="text-[10px] uppercase tracking-widest font-semibold text-amber-500">Vendor</span>
        </div>
      </div>

      <nav className="flex-1 px-4 space-y-1">
        {navItems.map((item) => {
          const isActive = pathname === item.href || pathname.startsWith(item.href + "/");
          return (
            <Link
              key={item.href}
              href={item.href}
              onClick={() => setMobileOpen(false)}
              className={cn(
                "flex items-center gap-3 px-4 py-3 rounded-sm text-sm font-medium transition-all duration-200",
                isActive
                  ? "bg-amber-600/10 text-amber-400 border-l-2 border-amber-500"
                  : "text-[var(--text-muted)] hover:text-[var(--text-primary)] hover:bg-[var(--bg-card-hover)]"
              )}
            >
              <item.icon size={18} className={isActive ? "text-amber-400" : "text-[var(--text-muted)]"} />
              {item.label}
            </Link>
          );
        })}
      </nav>

      <div className="p-4 border-t border-[var(--border-color)]">
        <button
          onClick={() => signOut({ callbackUrl: "/" })}
          className="flex items-center gap-3 w-full px-4 py-3 text-[var(--text-muted)] hover:text-red-500 hover:bg-red-900/10 rounded-sm text-sm font-medium transition-all"
        >
          <LogOut size={18} />
          Sign Out
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
        className="md:hidden fixed top-4 left-4 z-50 glass border border-[var(--border-color)] p-2 rounded-sm"
      >
        <Menu size={20} className="text-[var(--text-primary)]" />
      </button>

      {mobileOpen && (
        <div className="md:hidden fixed inset-0 z-50 flex">
          <div className="fixed inset-0 bg-black/50 backdrop-blur-sm" onClick={() => setMobileOpen(false)} />
          <aside className="relative w-64 bg-[var(--bg-secondary)] border-r border-[var(--border-color)] flex flex-col z-10">
            <button
              onClick={() => setMobileOpen(false)}
              className="absolute top-4 right-4 text-[var(--text-muted)] hover:text-[var(--text-primary)]"
            >
              <X size={20} />
            </button>
            <SidebarContent />
          </aside>
        </div>
      )}
    </>
  );
}
