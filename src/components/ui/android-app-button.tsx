"use client";

/**
 * APK download link. Defaults to the same-origin /downloads/motoxplus.apk path,
 * which next.config.mjs rewrites to the file in Cloudflare R2 (bucket
 * motoxplus-assets). Same-origin keeps the <a download> attribute working.
 * Override with NEXT_PUBLIC_APK_DOWNLOAD_URL if the file moves.
 */
const APK_DOWNLOAD_URL =
  process.env.NEXT_PUBLIC_APK_DOWNLOAD_URL || "/downloads/motoxplus.apk";

function AndroidIcon({ className }: { className?: string }) {
  return (
    <svg viewBox="0 0 24 24" fill="currentColor" className={className} aria-hidden="true">
      <path d="M17.523 15.34c-.552 0-1-.447-1-.999s.448-1 1-1c.551 0 .999.448.999 1s-.448.999-.999.999m-11.046 0c-.552 0-1-.447-1-.999s.448-1 1-1c.551 0 .999.448.999 1s-.448.999-.999.999m11.405-6.02 1.997-3.459a.416.416 0 0 0-.152-.568.416.416 0 0 0-.568.152l-2.022 3.503C15.59 8.244 13.853 7.851 12 7.851s-3.59.393-5.135 1.099L4.843 5.447a.416.416 0 0 0-.568-.152.416.416 0 0 0-.152.568l1.997 3.459C2.689 11.187.343 14.659 0 18.76h24c-.344-4.102-2.69-7.574-6.118-9.44" />
    </svg>
  );
}

/**
 * Sitewide floating APK download badge — the WhatsApp button (bottom-right)
 * establishes the fixed-corner-FAB pattern; this mirrors it on the left so
 * neither collides with the other or with product-catalog's centered
 * floating compare bar.
 */
export function AndroidAppButton() {
  return (
    <a
      href={APK_DOWNLOAD_URL}
      download
      aria-label="Get the Android App — Download APK for Android"
      className="fixed bottom-6 left-6 z-50 flex items-center gap-3 rounded-card bg-[#17181A] py-3 pl-3 pr-5 shadow-[var(--elev-3)] transition-[transform,box-shadow] duration-[var(--dur-2)] hover:-translate-y-0.5 hover:shadow-xl active:translate-y-0 focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-[var(--focus-ring)]"
    >
      <span className="flex h-10 w-10 flex-shrink-0 items-center justify-center rounded-sm bg-[var(--red)]">
        <AndroidIcon className="h-5 w-5 text-white" />
      </span>
      <span className="flex flex-col items-start leading-tight">
        <span className="font-display text-[13px] font-bold tracking-tight text-white sm:text-sm">
          Get the Android App
        </span>
        <span className="mt-0.5 text-[10px] text-white/60 sm:text-[11px]">
          Download APK for Android
        </span>
      </span>
    </a>
  );
}
