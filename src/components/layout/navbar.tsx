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
} from "lucide-react";
import { cn } from "@/lib/utils";
import { Button } from "@/components/ui/button";
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
  const vehiclesRef = useRef<HTMLDivElement>(null);
  const productsRef = useRef<HTMLDivElement>(null);
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

  const toggleMenu = useCallback((menu: "products" | "vehicles") => {
    if (closeTimer.current) clearTimeout(closeTimer.current);
    setOpenMenu((current) => (current === menu ? null : menu));
  }, []);

  // Click-to-toggle needs a click-outside handler since touch/trackpad
  // devices never fire mouseleave to close the dropdown.
  useEffect(() => {
    if (!openMenu) return;
    const handlePointerDown = (e: MouseEvent) => {
      const ref = openMenu === "vehicles" ? vehiclesRef : productsRef;
      if (ref.current && !ref.current.contains(e.target as Node)) {
        setOpenMenu(null);
      }
    };
    document.addEventListener("mousedown", handlePointerDown);
    return () => document.removeEventListener("mousedown", handlePointerDown);
  }, [openMenu]);

  const dashboardHref =
    session?.user?.role === "DEALER"
      ? "/dealer/dashboard"
      : session?.user?.role === "VENDOR"
      ? "/vendor/dashboard"
      : ["ADMIN", "SUPER_ADMIN"].includes(session?.user?.role ?? "")
      ? "/admin/dashboard"
      : "/login";

  return (
    <header className="fixed top-0 left-0 right-0 z-50">
      {/* backdrop-filter lives here, not on <header> — it establishes a new
          containing block for position:fixed descendants, which would break
          the mobile drawer's fixed top/bottom sizing against the viewport. */}
      <div
        className={cn(
          "transition-colors duration-300 border-b",
          scrolled || openMenu || isOpen
            ? "bg-[var(--paper)]/92 backdrop-blur-xl border-[var(--line)]"
            : "bg-transparent border-transparent"
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
              className="h-[40px] md:h-[52px] w-auto object-contain"
              priority
            />
            <div className="hidden sm:block">
              <span className="font-display text-[var(--ink)] font-bold text-lg md:text-xl tracking-tight leading-none">
                MOTOX<span className="text-[var(--red)]">PLUS</span>
              </span>
              <div className="text-[9px] text-[var(--muted)] tracking-[0.18em] leading-none mt-1.5 font-medium">
                INDIA PRIVATE LIMITED
              </div>
            </div>
          </Link>

          {/* Desktop nav */}
          <nav className="hidden lg:flex items-center gap-1">
            <Link href="/" className="nav-link px-4 py-2 text-sm font-medium text-[var(--muted)] hover:text-[var(--ink)] transition-colors">
              Home
            </Link>

            {/* Vehicles dropdown */}
            <div
              ref={vehiclesRef}
              className="relative"
              onMouseEnter={() => openWithDelay("vehicles")}
              onMouseLeave={closeWithDelay}
            >
              <button
                type="button"
                onClick={() => toggleMenu("vehicles")}
                aria-expanded={openMenu === "vehicles"}
                className={cn(
                  "nav-link flex items-center gap-1.5 px-4 py-2 text-sm font-medium transition-colors",
                  openMenu === "vehicles" ? "text-[var(--ink)]" : "text-[var(--muted)] hover:text-[var(--ink)]"
                )}
              >
                Vehicles
                <ChevronDown size={14} className={cn("transition-transform duration-200", openMenu === "vehicles" && "rotate-180")} />
              </button>

              <AnimatePresence>
                {openMenu === "vehicles" && (
                  <motion.div
                    initial={{ opacity: 0, y: 6 }}
                    animate={{ opacity: 1, y: 0 }}
                    exit={{ opacity: 0, y: 6 }}
                    transition={{ duration: 0.15, ease: [0.16, 1, 0.3, 1] }}
                    className="absolute top-full left-1/2 -translate-x-1/2 pt-3 w-[340px]"
                  >
                    <div className="bg-[var(--card)] border border-[var(--line)] rounded-lg shadow-[var(--elev-3)] p-2 overflow-hidden">
                      {VEHICLE_CATEGORIES.map((cat) => {
                        const Icon = VEHICLE_ICON[cat.value];
                        return (
                          <Link
                            key={cat.slug}
                            href={`/vehicles/${cat.slug}`}
                            className="group flex items-center gap-4 rounded-sm px-3 py-3 hover:bg-[var(--paper)] transition-colors"
                          >
                            <div className="w-9 h-9 rounded-sm border border-[var(--line)] flex items-center justify-center flex-shrink-0 group-hover:border-[var(--red)]/40 transition-colors">
                              <Icon size={16} className="text-[var(--muted)] group-hover:text-[var(--red)] transition-colors" />
                            </div>
                            <div className="flex-1 min-w-0">
                              <div className="text-[var(--ink)] font-semibold text-sm">{cat.label}</div>
                              <div className="text-[var(--muted)] text-xs truncate">{cat.tagline}</div>
                            </div>
                            <ChevronRight size={14} className="text-[var(--line)] group-hover:text-[var(--red)] group-hover:translate-x-0.5 transition-all flex-shrink-0" />
                          </Link>
                        );
                      })}
                      <div className="mt-1 pt-2 border-t border-[var(--line)]">
                        <Link
                          href="/vehicles"
                          className="flex items-center justify-center gap-2 rounded-sm px-3 py-2.5 text-[var(--red)] hover:text-[var(--red-hover)] text-xs font-bold uppercase tracking-wider transition-colors"
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
              ref={productsRef}
              className="relative"
              onMouseEnter={() => openWithDelay("products")}
              onMouseLeave={closeWithDelay}
            >
              <button
                type="button"
                onClick={() => toggleMenu("products")}
                aria-expanded={openMenu === "products"}
                className={cn(
                  "nav-link flex items-center gap-1.5 px-4 py-2 text-sm font-medium transition-colors",
                  openMenu === "products" ? "text-[var(--ink)]" : "text-[var(--muted)] hover:text-[var(--ink)]"
                )}
              >
                Products
                <ChevronDown size={14} className={cn("transition-transform duration-200", openMenu === "products" && "rotate-180")} />
              </button>

              <AnimatePresence>
                {openMenu === "products" && (
                  <motion.div
                    initial={{ opacity: 0, y: 6 }}
                    animate={{ opacity: 1, y: 0 }}
                    exit={{ opacity: 0, y: 6 }}
                    transition={{ duration: 0.15, ease: [0.16, 1, 0.3, 1] }}
                    className="absolute top-full left-1/2 -translate-x-1/2 pt-3 w-[600px]"
                  >
                    <div className="bg-[var(--card)] border border-[var(--line)] rounded-lg shadow-[var(--elev-3)] p-6 grid grid-cols-5 gap-6 overflow-hidden">
                      <div className="col-span-3">
                        <div className="text-[10px] font-bold uppercase tracking-widest text-[var(--muted)] mb-3 px-1">
                          Shop by Category
                        </div>
                        <div className="grid grid-cols-2 gap-1">
                          {categories.length === 0
                            ? Array.from({ length: 6 }).map((_, i) => (
                                <div key={i} className="h-11 rounded-sm skeleton" />
                              ))
                            : categories.map((cat) => (
                                <Link
                                  key={cat.id}
                                  href={`/products?category=${cat.slug}`}
                                  className="group flex items-center gap-3 rounded-sm px-3 py-2.5 hover:bg-[var(--paper)] transition-colors"
                                >
                                  <Wrench size={13} className="text-[var(--line)] group-hover:text-[var(--red)] transition-colors flex-shrink-0" />
                                  <span className="text-[var(--muted)] group-hover:text-[var(--ink)] text-sm truncate transition-colors">
                                    {cat.name}
                                  </span>
                                </Link>
                              ))}
                        </div>
                        <Link
                          href="/products"
                          className="mt-3 inline-flex items-center gap-2 px-1 text-[var(--red)] hover:text-[var(--red-hover)] text-xs font-bold uppercase tracking-wider transition-colors"
                        >
                          View All Products
                          <ArrowRight size={13} />
                        </Link>
                      </div>

                      <div className="col-span-2 relative border border-[var(--line)] rounded-sm p-6 flex flex-col justify-between min-h-[200px] bg-[var(--paper)]">
                        <div className="text-[10px] font-bold uppercase tracking-widest text-[var(--muted)]">
                          Dealer Access
                        </div>
                        <div>
                          <div className="text-[var(--ink)] font-display font-bold text-lg leading-tight mb-1">
                            Become a Dealer
                          </div>
                          <p className="text-[var(--muted)] text-xs leading-relaxed mb-4">
                            Get wholesale pricing and priority stock access.
                          </p>
                          <Button asChild variant="brand" size="sm">
                            <Link href="/become-dealer">
                              Apply Now
                              <ArrowRight size={12} />
                            </Link>
                          </Button>
                        </div>
                      </div>
                    </div>
                  </motion.div>
                )}
              </AnimatePresence>
            </div>

            <Link href="/about" className="nav-link px-4 py-2 text-sm font-medium text-[var(--muted)] hover:text-[var(--ink)] transition-colors">
              About
            </Link>
            <Link href="/contact" className="nav-link px-4 py-2 text-sm font-medium text-[var(--muted)] hover:text-[var(--ink)] transition-colors">
              Contact
            </Link>
          </nav>

          {/* Right side */}
          <div className="hidden lg:flex items-center gap-2.5">
            <Link
              href="/become-vendor"
              className="text-[var(--muted)] hover:text-[var(--ink)] text-sm font-medium px-3.5 py-2 transition-colors"
            >
              Become a Vendor
            </Link>
            <div className="w-px h-5 bg-[var(--line)]" />
            <ThemeToggle />
            {session ? (
              <Button asChild variant="brand" size="sm">
                <Link href={dashboardHref}>Dashboard</Link>
              </Button>
            ) : (
              <>
                <Link
                  href="/login"
                  className="text-[var(--muted)] hover:text-[var(--ink)] text-sm font-medium transition-colors px-3.5 py-2"
                >
                  Login
                </Link>
                <Button asChild variant="brand" size="sm">
                  <Link href="/become-dealer" className="group">
                    Become a Dealer
                    <ArrowRight size={14} className="group-hover:translate-x-0.5 transition-transform" />
                  </Link>
                </Button>
              </>
            )}
          </div>

          {/* Mobile right */}
          <div className="lg:hidden flex items-center gap-2">
            <ThemeToggle />
            <button
              onClick={() => setIsOpen((v) => !v)}
              className="text-[var(--ink)] p-2 rounded-sm hover:bg-[var(--paper)] transition-colors"
              aria-label="Toggle menu"
            >
              {isOpen ? <X size={22} /> : <Menu size={22} />}
            </button>
          </div>
        </div>
      </div>
      </div>

      {/* Mobile drawer */}
      <AnimatePresence>
        {isOpen && (
          <motion.div
            initial={{ opacity: 0, y: -8 }}
            animate={{ opacity: 1, y: 0 }}
            exit={{ opacity: 0, y: -8 }}
            transition={{ duration: 0.2, ease: [0.16, 1, 0.3, 1] }}
            className="lg:hidden fixed left-0 right-0 top-[72px] md:top-[88px] bottom-0 z-40 bg-[var(--paper)] border-t border-[var(--line)] overflow-y-auto"
          >
            <nav className="flex flex-col px-4 py-5 gap-1">
              {simpleLinks.slice(0, 1).map((link) => (
                <Link
                  key={link.href}
                  href={link.href}
                  onClick={() => setIsOpen(false)}
                  className="flex items-center justify-between font-medium py-3 px-3 rounded-sm text-sm text-[var(--muted)] hover:text-[var(--ink)] hover:bg-[var(--card)] transition-colors"
                >
                  {link.label}
                  <ChevronRight size={14} className="opacity-40" />
                </Link>
              ))}

              {/* Vehicles accordion */}
              <button
                onClick={() => setMobileGroup((g) => (g === "vehicles" ? null : "vehicles"))}
                className="flex items-center justify-between font-medium py-3 px-3 rounded-sm text-sm text-[var(--muted)] hover:text-[var(--ink)] hover:bg-[var(--card)] transition-colors"
              >
                Vehicles
                <ChevronDown size={15} className={cn("transition-transform duration-200", mobileGroup === "vehicles" && "rotate-180 text-[var(--red)]")} />
              </button>
              <AnimatePresence>
                {mobileGroup === "vehicles" && (
                  <motion.div
                    initial={{ opacity: 0, height: 0 }}
                    animate={{ opacity: 1, height: "auto" }}
                    exit={{ opacity: 0, height: 0 }}
                    transition={{ duration: 0.18 }}
                    className="overflow-hidden pl-2"
                  >
                    {VEHICLE_CATEGORIES.map((cat) => (
                      <Link
                        key={cat.slug}
                        href={`/vehicles/${cat.slug}`}
                        onClick={() => setIsOpen(false)}
                        className="flex items-center gap-3 py-2.5 px-3 rounded-sm text-sm text-[var(--muted)] hover:text-[var(--red)] transition-colors"
                      >
                        <span className="w-1 h-1 bg-[var(--red)]" />
                        {cat.label}
                      </Link>
                    ))}
                  </motion.div>
                )}
              </AnimatePresence>

              {/* Products accordion */}
              <button
                onClick={() => setMobileGroup((g) => (g === "products" ? null : "products"))}
                className="flex items-center justify-between font-medium py-3 px-3 rounded-sm text-sm text-[var(--muted)] hover:text-[var(--ink)] hover:bg-[var(--card)] transition-colors"
              >
                Products
                <ChevronDown size={15} className={cn("transition-transform duration-200", mobileGroup === "products" && "rotate-180 text-[var(--red)]")} />
              </button>
              <AnimatePresence>
                {mobileGroup === "products" && (
                  <motion.div
                    initial={{ opacity: 0, height: 0 }}
                    animate={{ opacity: 1, height: "auto" }}
                    exit={{ opacity: 0, height: 0 }}
                    transition={{ duration: 0.18 }}
                    className="overflow-hidden pl-2"
                  >
                    {categories.slice(0, 6).map((cat) => (
                      <Link
                        key={cat.id}
                        href={`/products?category=${cat.slug}`}
                        onClick={() => setIsOpen(false)}
                        className="flex items-center gap-3 py-2.5 px-3 rounded-sm text-sm text-[var(--muted)] hover:text-[var(--red)] transition-colors"
                      >
                        <span className="w-1 h-1 bg-[var(--red)]" />
                        {cat.name}
                      </Link>
                    ))}
                    <Link
                      href="/products"
                      onClick={() => setIsOpen(false)}
                      className="flex items-center gap-2 py-2.5 px-3 text-[var(--red)] text-xs font-bold uppercase tracking-wider"
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
                  className="flex items-center justify-between font-medium py-3 px-3 rounded-sm text-sm text-[var(--muted)] hover:text-[var(--ink)] hover:bg-[var(--card)] transition-colors"
                >
                  {link.label}
                  <ChevronRight size={14} className="opacity-40" />
                </Link>
              ))}

              <Link
                href="/become-vendor"
                onClick={() => setIsOpen(false)}
                className="flex items-center justify-between font-medium py-3 px-3 rounded-sm text-sm text-[var(--red)] hover:bg-[var(--red-soft)] transition-colors"
              >
                Become a Vendor
                <ChevronRight size={14} className="opacity-40" />
              </Link>

              <div className="pt-4 mt-2 border-t border-[var(--line)]">
                {session ? (
                  <Button asChild variant="brand" block onClick={() => setIsOpen(false)}>
                    <Link href={dashboardHref}>Go to Dashboard</Link>
                  </Button>
                ) : (
                  <div className="flex gap-2">
                    <Button asChild variant="ghost" block onClick={() => setIsOpen(false)}>
                      <Link href="/login">Login</Link>
                    </Button>
                    <Button asChild variant="brand" block onClick={() => setIsOpen(false)}>
                      <Link href="/become-dealer">Become a Dealer</Link>
                    </Button>
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
