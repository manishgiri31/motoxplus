import Image from "next/image";
import Link from "next/link";

interface AuthPageLayoutProps {
  children: React.ReactNode;
}

export function AuthPageLayout({ children }: AuthPageLayoutProps) {
  return (
    <div className="flex min-h-screen items-start justify-center bg-[var(--paper)] px-4 pb-16 pt-12 sm:items-center sm:pt-16">
      <div className="w-full max-w-[440px]">
        <div className="mb-8 text-center">
          <Link
            href="/"
            className="inline-flex flex-col items-center gap-3 rounded-lg focus-visible:outline-[var(--accent)]"
          >
            <Image
              src="/motoxplus/logo.png"
              alt="MOTOXPLUS India Private Limited"
              width={96}
              height={96}
              className="h-14 w-auto object-contain"
              priority
            />
            <span className="font-display text-[21px] font-semibold leading-none tracking-[-0.01em] text-[var(--ink)]">
              MOTOXPLUS
            </span>
          </Link>
        </div>
        {children}
      </div>
    </div>
  );
}

/** Shown while the auth card's client bundle / search params resolve — same footprint as the card, so nothing jumps. */
export function AuthCardSkeleton({ rows = 1 }: { rows?: number }) {
  return (
    <div className="rounded-[18px] bg-[var(--card)] p-8 sm:p-10" aria-hidden>
      <div className="skeleton mb-2 h-7 w-40" />
      <div className="skeleton mb-8 h-4 w-56" />
      {Array.from({ length: rows }).map((_, i) => (
        <div key={i} className="mb-5">
          <div className="skeleton mb-2 h-3 w-32" />
          <div className="skeleton h-12 w-full" />
        </div>
      ))}
      <div className="skeleton h-12 w-full !rounded-pill" />
    </div>
  );
}
