import Image from "next/image";
import Link from "next/link";
import { cn } from "@/lib/utils";
import { formatPrice } from "@/lib/store/format";
import { productHref } from "@/lib/store/products";
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
      <p className="mt-3 text-14">From {formatPrice(p.price, p.currency)}</p>
      <Image
        src={p.images[0]}
        alt={p.name}
        width={600}
        height={600}
        unoptimized
        priority={priority}
        className="mt-auto h-auto w-full pt-6"
        sizes="(max-width:834px) 80vw, 33vw"
      />
    </Link>
  );
}
