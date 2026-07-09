"use client";

import { useState, useEffect, useRef, useCallback } from "react";
import Link from "next/link";
import Image from "next/image";
import { useSession } from "next-auth/react";
import { AnimatePresence, motion } from "framer-motion";
import {
  Menu,
  X,
  ChevronDown,
  ChevronRight,
  Bike,
  Zap,
  Truck,
  Wrench,
  ArrowRight,
  Package,
} from "lucide-react";
import { cn } from "@/lib/utils";
import { ThemeToggle } from "@/components/ui/theme-toggle";
import { VEHICLE_CATEGORIES } from "@/lib/vehicle-categories";

interface CategoryLite {
  id: string;
  name: string;
  slug: string;
  _count?: { products: number };
}

const VEHICLE_ICON = {
  MOTORCYCLE: Bike,
  SCOOTER: Bike,
  ELECTRIC: Zap,
  COMMERCIAL: Truck,
} as const;

const simpleLinks = [
  { label: "Home", href: "/" },
  { label: "About", href: "/about" },
  { label: "Contact", href: "/contact" },
];

export function Navbar() {
  const [isOpen, setIsOpen] = useState(false);
  const [scrolled, setScrolled] = useState(false);
  const [openMenu, setOpenMenu] = useState<"products" | "vehicles" | null>(null);
  const [mobileGroup, setMobileGroup] = useState<"products" | "vehicles" | null>(null);
  const [categories, setCategories] = useState<CategoryLite[]>([]);
  const closeTimer = useRef<ReturnType<typeof setTimeout> | null>(null);
  const { data: session } = useSession();

  useEffect(() => {
    const handleScroll = () => setScrolled(window.scrollY > 12);
    handleScroll();
    window.addEventListener("scroll", handleScroll);
    return () => window.removeEventListener("scroll", handleScroll);
  }, []);

  useEffect(() => {
    let cancelled = false;
    fetch("/api/categories")
      .then((r) => (r.ok ? r.json() : []))
      .then((data: CategoryLite[]) => {
        if (!cancelled) setCategories(Array.isArray(data) ? data.slice(0, 8) : []);
      })
      .catch(() => {});
    return () => {
      cancelled = true;
    };
  }, []);

  // Lock body scroll while the mobile drawer is open
  useEffect(() => {
    document.body.style.overflow = isOpen ? "hidden" : "";
    return () => {
      document.body.style.overflow = "";
    };
  }, [isOpen]);

  const openWithDelay = useCallback((menu: "products" | "vehicles") => {
    if (closeTimer.current) clearTimeout(closeTimer.current);
    setOpenMenu(menu);
  }, []);

  const closeWithDelay = useCallback(() => {
    if (closeTimer.current) clearTimeout(closeTimer.current);
    closeTimer.current = setTimeout(() => setOpenMenu(null), 150);
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
        "fixed top-0 left-0 right-0 z-50 transition-all duration-500",
        scrolled || openMenu
          ? "bg-[var(--bg-secondary)]/85 backdrop-blur-2xl border-b border-[var(--border-color)] shadow-[0_1px_30px_rgba(0,0,0,0.15)]"
          : "bg-transparent border-b border-transparent"
      )}
    >
      <div className="max-w-7xl mx-auto px-4 md:px-8">
        <div className="flex items-center justify-between h-[72px] md:h-[88px]">
          {/* Logo */}
          <Link href="/" className="flex items-center gap-3 group flex-shrink-0">
            <Image
              src="/motoxplus/logo.png"
              alt="MOTOXPLUS India Private Limited"
              width={400}
              height={300}
              className="h-[44px] md:h-[60px] w-auto object-contain transition-transform duration-300 group-hover:scale-105 drop-shadow-[0_2px_10px_rgba(220,38,38,0.18)]"
              priority
            />
            <div className="hidden sm:block">
              <span className="text-[var(--text-primary)] font-black text-xl md:text-2xl tracking-tight leading-none">
                MOTOX<span className="text-red-600">PLUS</span>
              </span>
              <div className="text-[9px] md:text-[10px] text-[var(--text-muted)] tracking-[0.2em] leading-none mt-1.5">
                INDIA PRIVATE LIMITED
              </div>
            </div>
          </Link>

          {/* Desktop nav */}
          <nav className="hidden lg:flex items-center gap-1">
            <Link href="/" className="nav-link px-4 py-2 text-sm font-medium text-[var(--text-secondary)] hover:text-[var(--text-primary)] transition-colors">
              Home
            </Link>

            {/* Vehicles dropdown */}
            <div
              className="relative"
              onMouseEnter={() => openWithDelay("vehicles")}
              onMouseLeave={closeWithDelay}
            >
              <button
                className={cn(
                  "nav-link flex items-center gap-1.5 px-4 py-2 text-sm font-medium transition-colors",
                  openMenu === "vehicles" ? "text-[var(--text-primary)]" : "text-[var(--text-secondary)] hover:text-[var(--text-primary)]"
                )}
              >
                Vehicles
                <ChevronDown size={14} className={cn("transition-transform duration-300", openMenu === "vehicles" && "rotate-180")} />
              </button>

              <AnimatePresence>
                {openMenu === "vehicles" && (
                  <motion.div
                    initial={{ opacity: 0, y: 8, scale: 0.98 }}
                    animate={{ opacity: 1, y: 0, scale: 1 }}
                    exit={{ opacity: 0, y: 8, scale: 0.98 }}
                    transition={{ duration: 0.18, ease: [0.16, 1, 0.3, 1] }}
                    className="absolute top-full left-1/2 -translate-x-1/2 pt-3 w-[340px]"
                  >
                    <div className="glass border border-[var(--border-color)] rounded-2xl shadow-2xl p-3 overflow-hidden">
                      {VEHICLE_CATEGORIES.map((cat) => {
                        const Icon = VEHICLE_ICON[cat.value];
                        return (
                          <Link
                            key={cat.slug}
                            href={`/vehicles/${cat.slug}`}
                            className="group flex items-center gap-4 rounded-xl px-3 py-3 hover:bg-[var(--bg-card-hover)] transition-colors"
                          >
                            <div className="w-10 h-10 rounded-lg bg-red-600/10 border border-red-600/20 flex items-center justify-center flex-shrink-0 group-hover:bg-red-600/15 transition-colors">
                              <Icon size={18} className="text-red-500" />
                            </div>
                            <div className="flex-1 min-w-0">
                              <div className="text-[var(--text-primary)] font-semibold text-sm">{cat.label}</div>
                              <div className="text-[var(--text-muted)] text-xs truncate">{cat.tagline}</div>
                            </div>
                            <ChevronRight size={15} className="text-[var(--text-muted)] group-hover:text-red-500 group-hover:translate-x-0.5 transition-all flex-shrink-0" />
                          </Link>
                        );
                      })}
                      <div className="mt-1 pt-2 border-t border-[var(--border-color)]">
                        <Link
                          href="/vehicles"
                          className="flex items-center justify-center gap-2 rounded-xl px-3 py-2.5 text-red-500 hover:text-red-600 text-xs font-bold uppercase tracking-wider transition-colors"
                        >
                          Browse All Vehicles
                          <ArrowRight size={13} />
                        </Link>
                      </div>
                    </div>
                  </motion.div>
                )}
              </AnimatePresence>
            </div>

            {/* Products mega menu */}
            <div
              className="relative"
              onMouseEnter={() => openWithDelay("products")}
              onMouseLeave={closeWithDelay}
            >
              <button
                className={cn(
                  "nav-link flex items-center gap-1.5 px-4 py-2 text-sm font-medium transition-colors",
                  openMenu === "products" ? "text-[var(--text-primary)]" : "text-[var(--text-secondary)] hover:text-[var(--text-primary)]"
                )}
              >
                Products
                <ChevronDown size={14} className={cn("transition-transform duration-300", openMenu === "products" && "rotate-180")} />
              </button>

              <AnimatePresence>
                {openMenu === "products" && (
                  <motion.div
                    initial={{ opacity: 0, y: 8, scale: 0.98 }}
                    animate={{ opacity: 1, y: 0, scale: 1 }}
                    exit={{ opacity: 0, y: 8, scale: 0.98 }}
                    transition={{ duration: 0.18, ease: [0.16, 1, 0.3, 1] }}
                    className="absolute top-full left-1/2 -translate-x-1/2 pt-3 w-[640px]"
                  >
                    <div className="glass border border-[var(--border-color)] rounded-2xl shadow-2xl p-6 grid grid-cols-5 gap-6 overflow-hidden">
                      <div className="col-span-3">
                        <div className="text-[10px] font-bold uppercase tracking-widest text-[var(--text-muted)] mb-3 px-1">
                          Shop by Category
                        </div>
                        <div className="grid grid-cols-2 gap-1">
                          {categories.length === 0
                            ? Array.from({ length: 6 }).map((_, i) => (
                                <div key={i} className="h-11 rounded-lg skeleton" />
                              ))
                            : categories.map((cat) => (
                                <Link
                                  key={cat.id}
                                  href={`/products?category=${cat.slug}`}
                                  className="group flex items-center gap-3 rounded-lg px-3 py-2.5 hover:bg-[var(--bg-card-hover)] transition-colors"
                                >
                                  <Wrench size={14} className="text-[var(--text-muted)] group-hover:text-red-500 transition-colors flex-shrink-0" />
                                  <span className="text-[var(--text-secondary)] group-hover:text-[var(--text-primary)] text-sm truncate transition-colors">
                                    {cat.name}
                                  </span>
                                </Link>
                              ))}
                        </div>
                        <Link
                          href="/products"
                          className="mt-3 inline-flex items-center gap-2 px-1 text-red-500 hover:text-red-600 text-xs font-bold uppercase tracking-wider transition-colors"
                        >
                          View All Products
                          <ArrowRight size={13} />
                        </Link>
                      </div>

                      <div className="col-span-2 relative rounded-xl overflow-hidden bg-gradient-to-br from-red-700 via-red-600 to-red-800 p-6 flex flex-col justify-between min-h-[200px]">
                        <div className="absolute -right-8 -top-8 w-32 h-32 bg-white/10 rounded-full blur-2xl" />
                        <Package size={22} className="text-white/80 relative z-10" />
                        <div className="relative z-10">
                          <div className="text-white font-black text-lg leading-tight mb-1">
                            Become a Dealer
                          </div>
                          <p className="text-white/75 text-xs leading-relaxed mb-4">
                            Get wholesale pricing and priority stock access.
                          </p>
                          <Link
                            href="/become-dealer"
                            className="inline-flex items-center gap-2 bg-white text-red-700 text-xs font-bold px-4 py-2.5 rounded-lg hover:bg-white/90 transition-colors uppercase tracking-wider"
                          >
                            Apply Now
                            <ArrowRight size={12} />
                          </Link>
                        </div>
                      </div>
                    </div>
                  </motion.div>
                )}
              </AnimatePresence>
            </div>

            <Link href="/about" className="nav-link px-4 py-2 text-sm font-medium text-[var(--text-secondary)] hover:text-[var(--text-primary)] transition-colors">
              About
            </Link>
            <Link href="/contact" className="nav-link px-4 py-2 text-sm font-medium text-[var(--text-secondary)] hover:text-[var(--text-primary)] transition-colors">
              Contact
            </Link>
          </nav>

          {/* Right side */}
          <div className="hidden lg:flex items-center gap-2.5">
            <Link
              href="/become-vendor"
              className="text-[var(--text-secondary)] hover:text-red-500 text-sm font-medium px-3.5 py-2 transition-colors"
            >
              Become a Vendor
            </Link>
            <div className="w-px h-5 bg-[var(--border-color)]" />
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
                  className="text-[var(--text-secondary)] hover:text-[var(--text-primary)] text-sm font-medium transition-colors px-3.5 py-2"
                >
                  Login
                </Link>
                <Link
                  href="/become-dealer"
                  className="group flex items-center gap-2 bg-red-600 hover:bg-red-700 text-white text-sm font-semibold px-5 py-2.5 rounded-lg transition-all duration-200 red-glow-sm"
                >
                  Become a Dealer
                  <ArrowRight size={14} className="group-hover:translate-x-0.5 transition-transform" />
                </Link>
              </>
            )}
          </div>

          {/* Mobile right */}
          <div className="lg:hidden flex items-center gap-2">
            <ThemeToggle />
            <button
              onClick={() => setIsOpen((v) => !v)}
              className="text-[var(--text-primary)] p-2 rounded-lg hover:bg-[var(--bg-card-hover)] transition-colors"
              aria-label="Toggle menu"
            >
              {isOpen ? <X size={22} /> : <Menu size={22} />}
            </button>
          </div>
        </div>
      </div>

      {/* Mobile drawer */}
      <AnimatePresence>
        {isOpen && (
          <motion.div
            initial={{ opacity: 0, height: 0 }}
            animate={{ opacity: 1, height: "auto" }}
            exit={{ opacity: 0, height: 0 }}
            transition={{ duration: 0.25, ease: [0.16, 1, 0.3, 1] }}
            className="lg:hidden bg-[var(--bg-secondary)]/98 backdrop-blur-2xl border-t border-[var(--border-color)] shadow-xl overflow-hidden max-h-[calc(100vh-72px)] overflow-y-auto"
          >
            <nav className="flex flex-col px-4 py-5 gap-1">
              {simpleLinks.slice(0, 1).map((link) => (
                <Link
                  key={link.href}
                  href={link.href}
                  onClick={() => setIsOpen(false)}
                  className="flex items-center justify-between font-medium py-3 px-3 rounded-xl text-sm text-[var(--text-secondary)] hover:text-[var(--text-primary)] hover:bg-[var(--bg-card-hover)] transition-colors"
                >
                  {link.label}
                  <ChevronRight size={14} className="opacity-40" />
                </Link>
              ))}

              {/* Vehicles accordion */}
              <button
                onClick={() => setMobileGroup((g) => (g === "vehicles" ? null : "vehicles"))}
                className="flex items-center justify-between font-medium py-3 px-3 rounded-xl text-sm text-[var(--text-secondary)] hover:text-[var(--text-primary)] hover:bg-[var(--bg-card-hover)] transition-colors"
              >
                Vehicles
                <ChevronDown size={15} className={cn("transition-transform duration-300", mobileGroup === "vehicles" && "rotate-180 text-red-500")} />
              </button>
              <AnimatePresence>
                {mobileGroup === "vehicles" && (
                  <motion.div
                    initial={{ opacity: 0, height: 0 }}
                    animate={{ opacity: 1, height: "auto" }}
                    exit={{ opacity: 0, height: 0 }}
                    transition={{ duration: 0.2 }}
                    className="overflow-hidden pl-2"
                  >
                    {VEHICLE_CATEGORIES.map((cat) => (
                      <Link
                        key={cat.slug}
                        href={`/vehicles/${cat.slug}`}
                        onClick={() => setIsOpen(false)}
                        className="flex items-center gap-3 py-2.5 px-3 rounded-lg text-sm text-[var(--text-muted)] hover:text-red-500 transition-colors"
                      >
                        <span className="w-1 h-1 rounded-full bg-red-600" />
                        {cat.label}
                      </Link>
                    ))}
                  </motion.div>
                )}
              </AnimatePresence>

              {/* Products accordion */}
              <button
                onClick={() => setMobileGroup((g) => (g === "products" ? null : "products"))}
                className="flex items-center justify-between font-medium py-3 px-3 rounded-xl text-sm text-[var(--text-secondary)] hover:text-[var(--text-primary)] hover:bg-[var(--bg-card-hover)] transition-colors"
              >
                Products
                <ChevronDown size={15} className={cn("transition-transform duration-300", mobileGroup === "products" && "rotate-180 text-red-500")} />
              </button>
              <AnimatePresence>
                {mobileGroup === "products" && (
                  <motion.div
                    initial={{ opacity: 0, height: 0 }}
                    animate={{ opacity: 1, height: "auto" }}
                    exit={{ opacity: 0, height: 0 }}
                    transition={{ duration: 0.2 }}
                    className="overflow-hidden pl-2"
                  >
                    {categories.slice(0, 6).map((cat) => (
                      <Link
                        key={cat.id}
                        href={`/products?category=${cat.slug}`}
                        onClick={() => setIsOpen(false)}
                        className="flex items-center gap-3 py-2.5 px-3 rounded-lg text-sm text-[var(--text-muted)] hover:text-red-500 transition-colors"
                      >
                        <span className="w-1 h-1 rounded-full bg-red-600" />
                        {cat.name}
                      </Link>
                    ))}
                    <Link
                      href="/products"
                      onClick={() => setIsOpen(false)}
                      className="flex items-center gap-2 py-2.5 px-3 text-red-500 text-xs font-bold uppercase tracking-wider"
                    >
                      View All Products
                      <ArrowRight size={12} />
                    </Link>
                  </motion.div>
                )}
              </AnimatePresence>

              {simpleLinks.slice(1).map((link) => (
                <Link
                  key={link.href}
                  href={link.href}
                  onClick={() => setIsOpen(false)}
                  className="flex items-center justify-between font-medium py-3 px-3 rounded-xl text-sm text-[var(--text-secondary)] hover:text-[var(--text-primary)] hover:bg-[var(--bg-card-hover)] transition-colors"
                >
                  {link.label}
                  <ChevronRight size={14} className="opacity-40" />
                </Link>
              ))}

              <Link
                href="/become-vendor"
                onClick={() => setIsOpen(false)}
                className="flex items-center justify-between font-medium py-3 px-3 rounded-xl text-sm text-red-500 hover:bg-red-950/20 transition-colors"
              >
                Become a Vendor
                <ChevronRight size={14} className="opacity-40" />
              </Link>

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
          </motion.div>
        )}
      </AnimatePresence>
    </header>
  );
}
