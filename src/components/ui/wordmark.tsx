import { cn } from "@/lib/utils";

/**
 * Text-only wordmark lockup — deliberately does NOT attempt to redraw the
 * actual MOTOXPLUS logomark (the angular M/A icon in public/motoxplus/logo.png)
 * as SVG: that's a real, specific piece of brand artwork, and reverse-tracing
 * it from a raster export would produce an inaccurate copy of the company's
 * actual mark. Use this for the "MOTOX" + "PLUS" two-tone text treatment only
 * (loading states, print, tight spaces) — the icon mark stays the raster
 * asset until a real vector source is provided.
 */
export function Wordmark({
  size = "md",
  className,
}: {
  size?: "sm" | "md" | "lg";
  className?: string;
}) {
  const sizeClass = size === "sm" ? "text-lg" : size === "lg" ? "text-3xl" : "text-xl";
  return (
    <span className={cn("font-black tracking-tight leading-none text-[var(--text-primary)]", sizeClass, className)}>
      MOTOX<span className="text-[var(--accent-text)]">PLUS</span>
    </span>
  );
}
