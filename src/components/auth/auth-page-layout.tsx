import Image from "next/image";
import Link from "next/link";
import { ArrowLeft } from "lucide-react";

interface AuthPageLayoutProps {
  children: React.ReactNode;
}

// public/motoxplus/logo.png is a 1536×1024 canvas with the mark occupying
// roughly the middle 45%. Rendering it as-is leaves a ~40px logo floating in
// 84px of padding, so the mark is cropped by positioning the full image inside
// an overflow-hidden box whose aspect matches the mark's bounding box
// (x 400–1085, y 270–690 of the source).
function BrandMark({ className = "h-11" }: { className?: string }) {
  return (
    <span className={`relative block aspect-[685/420] overflow-hidden ${className}`}>
      <Image
        src="/motoxplus/logo.png"
        alt="MOTOXPLUS India"
        width={1536}
        height={1024}
        priority
        className="absolute max-w-none"
        style={{ width: "224.2%", left: "-58.4%", top: "-64.3%" }}
      />
    </span>
  );
}

const POINTS = [
  { title: "Live pricing and stock", body: "Current rates and availability on every part, dealer schemes included." },
  { title: "Orders and GST invoices", body: "Place orders, download invoices and follow dispatch in one place." },
  { title: "Sign-in you can trust", body: "Verified contact details, one-time codes, and automatic lockout after repeated failures." },
];

export function AuthPageLayout({ children }: AuthPageLayoutProps) {
  return (
    <div className="min-h-screen bg-[var(--paper)] lg:grid lg:grid-cols-[minmax(400px,5fr)_7fr]">
      <aside className="relative hidden border-r border-[var(--line)] bg-[var(--card)] lg:block">
        <div className="bp-grid pointer-events-none absolute inset-0 [mask-image:linear-gradient(to_bottom,black,transparent_85%)]" aria-hidden />
        <div className="sticky top-0 flex h-screen flex-col justify-between p-12 xl:p-14">
          <Link href="/" aria-label="MOTOXPLUS India — home" className="w-fit rounded-md focus-visible:outline-2 focus-visible:outline-offset-4 focus-visible:outline-[var(--focus-ring)]">
            <BrandMark className="h-12" />
          </Link>

          <div className="max-w-[420px]">
            <p className="mb-5 font-mono text-12 uppercase tracking-[0.14em] text-[var(--muted)]">MOTOXPLUS India</p>
            <h2 className="font-display text-[34px] font-semibold leading-[1.12] tracking-[-0.02em] text-[var(--ink)] [text-wrap:balance] xl:text-40">
              Parts, pricing and paperwork. One account.
            </h2>
            <ol className="mt-10 border-t border-[var(--line)]">
              {POINTS.map((p, i) => (
                <li key={p.title} className="grid grid-cols-[28px_1fr] gap-x-3 border-b border-[var(--line)] py-4">
                  <span className="pt-0.5 font-mono text-12 text-[var(--muted)]">0{i + 1}</span>
                  <div>
                    <p className="text-[15px] font-semibold text-[var(--ink)]">{p.title}</p>
                    <p className="mt-0.5 text-14 text-[var(--muted)]">{p.body}</p>
                  </div>
                </li>
              ))}
            </ol>
          </div>

          <p className="text-12 text-[var(--muted)]">
            &copy; {new Date().getFullYear()} MOTOXPLUS India Private Limited
            <span className="mx-2 text-[var(--line)]" aria-hidden>|</span>
            <Link href="/terms" className="underline-offset-2 hover:text-[var(--ink)] hover:underline">Terms</Link>
            <span className="mx-2 text-[var(--line)]" aria-hidden>|</span>
            <Link href="/privacy" className="underline-offset-2 hover:text-[var(--ink)] hover:underline">Privacy</Link>
          </p>
        </div>
      </aside>

      <main className="flex min-h-screen flex-col">
        <header className="flex items-center justify-between px-5 py-5 sm:px-8 lg:justify-end lg:px-12 lg:py-7">
          <Link href="/" aria-label="MOTOXPLUS India — home" className="rounded-md focus-visible:outline-2 focus-visible:outline-offset-4 focus-visible:outline-[var(--focus-ring)] lg:hidden">
            <BrandMark className="h-9" />
          </Link>
          <Link href="/" className="inline-flex items-center gap-1.5 text-14 text-[var(--muted)] transition-colors hover:text-[var(--ink)]">
            <ArrowLeft size={14} aria-hidden /> Back to site
          </Link>
        </header>
        <div className="flex flex-1 items-start justify-center px-5 pb-16 pt-4 sm:px-8 lg:items-center lg:pt-0">
          <div className="w-full max-w-[400px]">{children}</div>
        </div>
      </main>
    </div>
  );
}

/** Shown while the auth card's client bundle / search params resolve — same footprint as the form, so nothing jumps. */
export function AuthCardSkeleton({ rows = 1 }: { rows?: number }) {
  return (
    <div aria-hidden>
      <div className="skeleton mb-2 h-8 w-44" />
      <div className="skeleton mb-8 h-4 w-60" />
      {Array.from({ length: rows }).map((_, i) => (
        <div key={i} className="mb-5">
          <div className="skeleton mb-2 h-3 w-28" />
          <div className="skeleton h-12 w-full" />
        </div>
      ))}
      <div className="skeleton h-12 w-full !rounded-pill" />
    </div>
  );
}
