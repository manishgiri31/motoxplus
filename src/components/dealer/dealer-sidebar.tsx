"use client";

import { useState } from "react";
import Link from "next/link";
import Image from "next/image";
import { usePathname } from "next/navigation";
import { fullLogout } from "@/lib/auth/client-logout";
import {
  LayoutDashboard,
  Package,
  ShoppingCart,
  ClipboardList,
  FileText,
  FolderOpen,
  User,
  LogOut,
  Menu,
  X,
} from "lucide-react";
import { Spinner } from "@/components/ui/spinner";
import { cn } from "@/lib/utils";

const navItems = [
  { icon: LayoutDashboard, label: "Dashboard", href: "/dealer/dashboard" },
  { icon: Package, label: "Products", href: "/dealer/products" },
  { icon: ShoppingCart, label: "Cart", href: "/dealer/cart" },
  { icon: ClipboardList, label: "Orders", href: "/dealer/orders" },
  { icon: FileText, label: "Invoices", href: "/dealer/invoices" },
  { icon: FolderOpen, label: "Documents", href: "/dealer/documents" },
  { icon: User, label: "Profile", href: "/dealer/profile" },
];

interface Props {
  user: {
    name?: string | null;
    email?: string | null;
  };
}

export function DealerSidebar({ user }: Props) {
  const pathname = usePathname();
  const [mobileOpen, setMobileOpen] = useState(false);
  const [signingOut, setSigningOut] = useState(false);

  const handleSignOut = async () => {
    setSigningOut(true);
    await fullLogout("/");
  };

  const SidebarContent = () => (
    <div className="flex flex-col h-full">
      {/* Logo */}
      <div className="p-5 border-b border-[var(--border-color)]">
        <Link href="/" className="flex flex-col items-center gap-2.5 text-center">
          <Image
            src="/motoxplus/logo.png"
            alt="MOTOXPLUS"
            width={60}
            height={60}
            className="object-contain"
          />
          <div>
            <div className="text-[var(--text-primary)] font-black text-sm leading-tight">
              MOTOX<span className="text-[var(--accent)]">PLUS</span>
            </div>
            <div className="text-[var(--text-muted)] text-12 leading-tight">India Private Limited</div>
            <div className="text-[var(--accent-text)] text-12 mt-1 font-semibold">Dealer Portal</div>
          </div>
        </Link>
      </div>

      {/* User info */}
      <div className="px-4 pt-4 pb-2">
        <div className="glass border border-[var(--border-color)] rounded-xl p-3">
          <div className="flex items-center gap-2.5">
            <div className="w-8 h-8 rounded-lg bg-green-900/20 border border-green-900/30 flex items-center justify-center flex-shrink-0">
              <span className="text-green-400 font-black text-xs">
                {(user.name || "D").charAt(0).toUpperCase()}
              </span>
            </div>
            <div className="min-w-0 flex-1">
              <div className="text-[var(--text-primary)] font-semibold text-xs truncate">{user.name}</div>
              <div className="text-[var(--text-muted)] text-12 truncate">{user.email}</div>
            </div>
          </div>
          <div className="mt-2">
            <span className="text-12 uppercase font-bold px-2 py-0.5 rounded-full text-green-400 bg-green-500/10">
              Active Dealer
            </span>
          </div>
        </div>
      </div>

      {/* Nav */}
      <nav className="flex-1 px-3 py-2">
        {navItems.map((item) => {
          const isActive = pathname === item.href || pathname.startsWith(item.href + "/");
          return (
            <Link
              key={item.href}
              href={item.href}
              onClick={() => setMobileOpen(false)}
              className={cn(
                "flex items-center gap-3 px-3 py-2.5 rounded-lg text-14 font-medium transition-colors duration-[var(--dur-2)] mb-0.5",
                isActive
                  ? "bg-[var(--accent-soft)] text-[var(--accent-text)]"
                  : "text-[var(--text-muted)] hover:text-[var(--text-primary)] hover:bg-[var(--bg-card-hover)]"
              )}
            >
              <item.icon
                size={17}
                className={cn("flex-shrink-0 transition-colors", isActive ? "text-[var(--accent)]" : "text-[var(--text-muted)]")}
              />
              <span>{item.label}</span>
              </Link>
          );
        })}
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
      {/* Desktop sidebar */}
      <aside className="hidden md:flex fixed left-0 top-0 bottom-0 w-64 bg-[var(--bg-secondary)] border-r border-[var(--border-subtle)] flex-col z-40">
        <SidebarContent />
      </aside>

      {/* Mobile toggle */}
      <button
        onClick={() => setMobileOpen(true)}
        className="md:hidden fixed top-4 left-4 z-50 glass border border-[var(--border-color)] p-2 rounded-xl"
      >
        <Menu size={20} className="text-[var(--text-primary)]" />
      </button>

      {/* Mobile sidebar */}
      {mobileOpen && (
        <div className="md:hidden fixed inset-0 z-50 flex">
          <div
            className="fixed inset-0 bg-black/60 backdrop-blur-sm animate-fade-in"
            onClick={() => setMobileOpen(false)}
          />
          <aside className="relative w-64 bg-[var(--bg-secondary)] border-r border-[var(--border-subtle)] flex flex-col z-10 animate-slide-in-left">
            <button
              onClick={() => setMobileOpen(false)}
              className="absolute top-4 right-4 text-[var(--text-muted)] hover:text-[var(--text-primary)] p-1"
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
