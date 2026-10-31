import Image from "next/image";
import Link from "next/link";
import { cn } from "@/lib/utils";
import { formatPrice } from "@/lib/store/format";
import { imageUrl, productHref } from "@/lib/store/products";
import type { StoreProduct } from "@/types/store";

export function ProductCard({ p, dark, priority }: { p: StoreProduct; dark?: boolean; priority?: boolean }) {
  return (
    <Link
      href={productHref(p)}
      className={cn(
        "group flex h-full flex-col items-center rounded-store-card px-8 py-10 text-center transition-transform duration-slow ease-apple-out hover:scale-[1.015] focus-visible:outline-store-accent",
        dark ? "bg-store-bg-inverse2 text-store-ink-inverse" : "bg-store-bg-alt text-store-ink"
      )}
    >
      <span className="min-h-[16px] text-12 font-semibold text-[#bf4800]">{p.badge}</span>
      <h3 className="mt-1 text-28 font-semibold tracking-[-0.005em]">{p.name}</h3>
      <p className={cn("mt-2 text-17", dark ? "text-white/70" : "text-store-ink-2")}>{p.tagline}</p>
      <p className={cn("mt-3 text-14", p.price == null && (dark ? "text-store-link-dark" : "text-store-link"))}>
        {p.price != null ? `From ${formatPrice(p.price, p.currency)}` : <>Shop now &rsaquo;</>}
      </p>
      {/* Photos are shot on white: multiply melts the plate into the grey card; on the dark card it stays a white plate. */}
      <div className={cn("mt-auto w-full pt-6")}>
        <div className={cn("relative aspect-square w-full", dark && "rounded-xl bg-white")}>
          <Image
            src={imageUrl(p.images[0])}
            alt={p.name}
            fill
            priority={priority}
            sizes="(max-width:834px) 80vw, 33vw"
            className={cn("object-contain", dark ? "p-3" : "mix-blend-multiply")}
          />
        </div>
      </div>
    </Link>
  );
}
