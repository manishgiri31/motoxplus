"use client";

import { useState, useEffect } from "react";
import Link from "next/link";
import Image from "next/image";
import { useSession } from "next-auth/react";
import { Menu, X, ChevronRight } from "lucide-react";
import { cn } from "@/lib/utils";
import { ThemeToggle } from "@/components/ui/theme-toggle";

const navLinks = [
  { label: "Home", href: "/" },
  { label: "Products", href: "/products" },
  { label: "About", href: "/about" },
  { label: "Become a Dealer", href: "/become-dealer" },
  { label: "Become a Vendor", href: "/become-vendor" },
  { label: "Contact", href: "/contact" },
];

export function Navbar() {
  const [isOpen, setIsOpen] = useState(false);
  const [scrolled, setScrolled] = useState(false);
  const { data: session } = useSession();

  useEffect(() => {
    const handleScroll = () => setScrolled(window.scrollY > 20);
    window.addEventListener("scroll", handleScroll);
    return () => window.removeEventListener("scroll", handleScroll);
  }, []);

  const dashboardHref =
    session?.user?.role === "DEALER"
      ? "/dealer/dashboard"
      : session?.user?.role === "VENDOR"
      ? "/vendor/dashboard"
      : ["ADMIN", "SUPER_ADMIN"].includes(session?.user?.role ?? "")
      ? "/admin/dashboard"
      : "/login";

  return (
    <header
      className={cn(
        "fixed top-0 left-0 right-0 z-50 transition-all duration-300",
        scrolled
          ? "bg-[var(--bg-secondary)]/92 backdrop-blur-2xl border-b border-[var(--border-color)] shadow-[0_1px_24px_rgba(0,0,0,0.18)]"
          : "bg-transparent"
      )}
    >
      <div className="max-w-7xl mx-auto px-4 md:px-8">
        <div className="flex items-center justify-between h-[68px] md:h-[84px]">

          {/* Logo */}
          <Link href="/" className="flex items-center gap-3 group flex-shrink-0">
            <Image
              src="/motoxplus/logo.png"
              alt="MOTOXPLUS India Private Limited"
              width={400}
              height={300}
              className="h-[50px] md:h-[68px] w-auto object-contain group-hover:scale-105 transition-transform duration-300 drop-shadow-[0_2px_10px_rgba(220,38,38,0.18)]"
              priority
            />
            <div className="hidden sm:block">
              <span className="text-[var(--text-primary)] font-black text-xl md:text-2xl tracking-wide leading-none">
                MOTOX<span className="text-red-500">PLUS</span>
              </span>
              <div className="text-[9px] md:text-[10px] text-[var(--text-muted)] tracking-widest leading-none mt-1">
                India Private Limited
              </div>
            </div>
          </Link>

          {/* Desktop Nav */}
          <nav className="hidden md:flex items-center gap-7">
            {navLinks.map((link) => (
              <Link
                key={link.href}
                href={link.href}
                className={cn(
                  "nav-link text-sm font-medium tracking-wide transition-colors duration-200",
                  link.href === "/become-dealer" || link.href === "/become-vendor"
                    ? "text-red-500 hover:text-red-400"
                    : "text-[var(--text-secondary)] hover:text-[var(--text-primary)]"
                )}
              >
                {link.label}
              </Link>
            ))}
          </nav>

          {/* Right side */}
          <div className="hidden md:flex items-center gap-3">
            <ThemeToggle />
            {session ? (
              <Link
                href={dashboardHref}
                className="bg-red-600 hover:bg-red-700 text-white text-sm font-semibold px-5 py-2.5 rounded-lg transition-all duration-200 red-glow-sm"
              >
                Dashboard
              </Link>
            ) : (
              <>
                <Link
                  href="/login"
                  className="text-[var(--text-secondary)] hover:text-[var(--text-primary)] text-sm font-medium transition-colors px-3 py-2"
                >
                  Login
                </Link>
                <Link
                  href="/become-dealer"
                  className="bg-red-600 hover:bg-red-700 text-white text-sm font-semibold px-5 py-2.5 rounded-lg transition-all duration-200 red-glow-sm"
                >
                  Become a Dealer
                </Link>
              </>
            )}
          </div>

          {/* Mobile right */}
          <div className="md:hidden flex items-center gap-2">
            <ThemeToggle />
            <button
              onClick={() => setIsOpen(!isOpen)}
              className="text-[var(--text-primary)] p-2 rounded-lg hover:bg-[var(--bg-card-hover)] transition-colors"
              aria-label="Toggle menu"
            >
              {isOpen ? <X size={22} /> : <Menu size={22} />}
            </button>
          </div>
        </div>
      </div>

      {/* Mobile Menu */}
      {isOpen && (
        <div className="md:hidden bg-[var(--bg-secondary)]/97 backdrop-blur-2xl border-t border-[var(--border-color)] shadow-xl animate-slide-up">
          <nav className="flex flex-col px-4 py-5 gap-0.5">
            {navLinks.map((link) => (
              <Link
                key={link.href}
                href={link.href}
                onClick={() => setIsOpen(false)}
                className={cn(
                  "flex items-center justify-between font-medium py-3 px-3 rounded-xl text-sm transition-colors",
                  link.href === "/become-dealer" || link.href === "/become-vendor"
                    ? "text-red-500 hover:bg-red-950/30"
                    : "text-[var(--text-secondary)] hover:text-[var(--text-primary)] hover:bg-[var(--bg-card-hover)]"
                )}
              >
                {link.label}
                <ChevronRight size={14} className="opacity-40" />
              </Link>
            ))}
            <div className="pt-4 mt-2 border-t border-[var(--border-color)]">
              {session ? (
                <Link
                  href={dashboardHref}
                  className="flex items-center justify-center bg-red-600 hover:bg-red-700 text-white font-semibold py-3 rounded-xl text-sm transition-colors red-glow-sm"
                  onClick={() => setIsOpen(false)}
                >
                  Go to Dashboard
                </Link>
              ) : (
                <div className="flex gap-2">
                  <Link
                    href="/login"
                    className="flex-1 flex items-center justify-center glass border border-[var(--border-color)] text-[var(--text-secondary)] font-semibold py-3 rounded-xl text-sm transition-colors hover:border-red-600/40"
                    onClick={() => setIsOpen(false)}
                  >
                    Login
                  </Link>
                  <Link
                    href="/become-dealer"
                    className="flex-1 flex items-center justify-center bg-red-600 hover:bg-red-700 text-white font-semibold py-3 rounded-xl text-sm transition-colors"
                    onClick={() => setIsOpen(false)}
                  >
                    Become a Dealer
                  </Link>
                </div>
              )}
            </div>
          </nav>
        </div>
      )}
    </header>
  );
}
