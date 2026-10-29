"use client";

import { useState, useEffect, useRef } from "react";
import Link from "next/link";
import Image from "next/image";
import { usePathname } from "next/navigation";
import { useSession } from "next-auth/react";
import { Menu, Search, X } from "lucide-react";
import { cn } from "@/lib/utils";
import { StoreButton } from "@/components/store/button";

const links = [
  { label: "Products", href: "/products" },
  { label: "Vehicles", href: "/vehicles" },
  { label: "About", href: "/about" },
  { label: "Contact", href: "/contact" },
  { label: "Become a Vendor", href: "/become-vendor" },
];

const focus = "focus-visible:outline-store-accent";

export function Navbar() {
  const [open, setOpen] = useState(false);
  const menuButton = useRef<HTMLButtonElement>(null);
  const { data: session } = useSession();
  const pathname = usePathname();

  // The layout persists across navigations, so close the menu when the route changes.
  useEffect(() => setOpen(false), [pathname]);

  const role = session?.user?.role ?? "";
  const dashboardHref =
    role === "DEALER"
      ? "/dealer/dashboard"
      : role === "VENDOR"
      ? "/vendor/dashboard"
      : ["ADMIN", "SUPER_ADMIN"].includes(role)
      ? "/admin/dashboard"
      : "/login";

  // Lock page scroll while the mobile menu is open; Escape closes it and returns focus.
  useEffect(() => {
    if (!open) return;
    document.body.style.overflow = "hidden";
    const onKey = (e: KeyboardEvent) => {
      if (e.key === "Escape") {
        setOpen(false);
        menuButton.current?.focus();
      }
    };
    document.addEventListener("keydown", onKey);
    return () => {
      document.body.style.overflow = "";
      document.removeEventListener("keydown", onKey);
    };
  }, [open]);

  // Close the menu if the viewport grows past the point where it is shown.
  useEffect(() => {
    const mq = window.matchMedia("(min-width: 734px)");
    const onChange = () => mq.matches && setOpen(false);
    mq.addEventListener("change", onChange);
    return () => mq.removeEventListener("change", onChange);
  }, []);

  return (
    <header className="sticky top-0 z-[9998] h-12 bg-white/80 font-store backdrop-blur-xl backdrop-saturate-150 supports-[not(backdrop-filter:blur(1px))]:bg-white/95 bp-md:h-11">
      <nav aria-label="Main" className="mx-auto flex h-full max-w-[1024px] items-center justify-between px-[22px]">
        <Link href="/" className={cn("flex items-center gap-2 text-17 font-semibold text-store-ink", focus)}>
          <Image src="/motoxplus/logo.png" alt="" width={400} height={300} className="h-6 w-auto object-contain" priority />
          MOTOXPLUS
        </Link>

        <ul className="hidden h-full items-center bp-md:flex">
          {links.map((l) => (
            <li key={l.href} className={cn("h-full", l.href === "/become-vendor" && "hidden bp-lg:block")}>
              <Link
                href={l.href}
                className={cn(
                  "flex h-full items-center whitespace-nowrap px-2 text-12 text-black/80 transition-colors duration-base ease-apple hover:text-black bp-lg:px-3",
                  focus
                )}
              >
                {l.label}
              </Link>
            </li>
          ))}
        </ul>

        <div className="flex items-center gap-1">
          <Link href="/products" aria-label="Search products" className={cn("grid h-11 w-11 place-items-center text-black/80 hover:text-black", focus)}>
            <Search size={16} />
          </Link>
          <div className="hidden items-center gap-3 bp-md:flex">
            {!session && (
              <Link href="/login" className={cn("text-12 text-black/80 transition-colors duration-base ease-apple hover:text-black", focus)}>
                Login
              </Link>
            )}
            {session ? (
              <StoreButton href={dashboardHref} size="sm" className="whitespace-nowrap px-3 py-1 text-12">
                Dashboard
              </StoreButton>
            ) : (
              <StoreButton href="/become-dealer" size="sm" className="whitespace-nowrap px-3 py-1 text-12">
                Become a Dealer
              </StoreButton>
            )}
          </div>
          <button
            ref={menuButton}
            type="button"
            onClick={() => setOpen((v) => !v)}
            aria-label={open ? "Close menu" : "Open menu"}
            aria-expanded={open}
            aria-controls="mobile-menu"
            className={cn("grid h-11 w-11 place-items-center text-store-ink bp-md:hidden", focus)}
          >
            {open ? <X size={20} /> : <Menu size={20} />}
          </button>
        </div>
      </nav>

      {open && (
        <div id="mobile-menu" className="fixed inset-x-0 bottom-0 top-12 overflow-y-auto bg-white bp-md:hidden">
          <ul className="mx-auto max-w-[1024px] px-[22px] pt-4">
            {[{ label: "Home", href: "/" }, ...links].map((l) => (
              <li key={l.href} className="border-b border-store-line-soft">
                <Link
                  href={l.href}
                  className={cn("flex min-h-[56px] items-center text-24 font-semibold text-store-ink", focus)}
                >
                  {l.label}
                </Link>
              </li>
            ))}
          </ul>
          <div className="mx-auto flex max-w-[1024px] flex-col gap-3 px-[22px] py-8">
            {session ? (
              <StoreButton href={dashboardHref}>
                Go to Dashboard
              </StoreButton>
            ) : (
              <>
                <StoreButton href="/become-dealer">Become a Dealer</StoreButton>
                <StoreButton href="/login" variant="secondary">
                  Login
                </StoreButton>
              </>
            )}
          </div>
        </div>
      )}
    </header>
  );
}
