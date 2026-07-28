"use client";

import * as React from "react";
import NextImage, { type ImageProps } from "next/image";
import { ImageIcon } from "lucide-react";
import { cn } from "@/lib/utils";
import { media as getMedia, isPending, type MediaSlotId } from "@/lib/media";
import { CornerFrame, Hatch } from "./technical";

/**
 * 24 existing `<Image>` call sites pass `unoptimized`, bypassing Next's
 * optimizer (AVIF/WebP, resizing, the 86400s cache TTL already configured in
 * next.config.mjs) entirely. This wrapper defaults to OPTIMIZED and is the
 * only new optimized-image path added in Phase 1 — the 24 legacy sites keep
 * their prop untouched and migrate file-by-file later. If R2 image
 * optimization ever misbehaves in production, flip
 * NEXT_PUBLIC_IMG_UNOPTIMIZED=1 to revert every MediaSlot/Img instance at once,
 * no code change required.
 */
const FORCE_UNOPTIMIZED = process.env.NEXT_PUBLIC_IMG_UNOPTIMIZED === "1";

export function Img(props: ImageProps) {
  return <NextImage unoptimized={FORCE_UNOPTIMIZED} {...props} />;
}

function PlaceholderPlate({ aspect, brief, className }: { aspect: string; brief: string; className?: string }) {
  return (
    <div
      className={cn("relative flex items-center justify-center overflow-hidden bg-[var(--surface-2)] bp-grid", className)}
      style={{ aspectRatio: aspect }}
    >
      <Hatch className="opacity-60 [clip-path:polygon(60%_100%,100%_100%,100%_40%)]" />
      <CornerFrame size={12} className="absolute inset-3" />
      <div className="relative z-[1] flex flex-col items-center gap-2 px-6 text-center">
        <ImageIcon size={20} className="text-[var(--text-faint)]" aria-hidden />
        <span className="text-[10px] font-semibold uppercase tracking-eyebrow text-[var(--text-muted)]">
          Plate — {aspect}
        </span>
        {process.env.NODE_ENV !== "production" && (
          <span className="max-w-[220px] text-[10px] leading-relaxed text-[var(--text-faint)]">{brief}</span>
        )}
      </div>
    </div>
  );
}

export interface MediaSlotProps {
  id: MediaSlotId;
  /** Required — Next warns (correctly) on `fill` without it, and it's easy to forget. */
  sizes: string;
  priority?: boolean;
  className?: string;
  fit?: "cover" | "contain";
  frame?: "none" | "hairline" | "corner";
  overlay?: "none" | "scrim" | "grid";
  children?: React.ReactNode;
}

/** Photo/video slot driven by src/lib/media.ts. Renders the real asset once
 *  `src` is set, or a designed placeholder plate — never a broken image or an
 *  empty box — until then. `aspect` is fixed from the manifest, so swapping
 *  in the real asset later causes zero layout shift. */
export function MediaSlot({ id, sizes, priority, className, fit = "cover", frame = "none", overlay = "none", children }: MediaSlotProps) {
  const asset = getMedia(id);

  const frameClass =
    frame === "corner" ? "" : frame === "hairline" ? "border border-[var(--border-color)]" : "";

  if (isPending(asset)) {
    return (
      <div className={cn("relative", frameClass, className)}>
        <PlaceholderPlate aspect={asset.aspect} brief={asset.brief} />
        {frame === "corner" && <CornerFrame size={14} className="absolute inset-0 pointer-events-none" />}
        {children}
      </div>
    );
  }

  return (
    <div className={cn("relative overflow-hidden", frameClass, className)} style={{ aspectRatio: asset.aspect }}>
      <Img
        src={asset.src as string}
        alt={asset.alt}
        fill
        sizes={sizes}
        priority={priority}
        className={fit === "contain" ? "object-contain" : "object-cover"}
        style={asset.focal ? { objectPosition: `${asset.focal.x * 100}% ${asset.focal.y * 100}%` } : undefined}
      />
      {overlay === "scrim" && (
        <div
          aria-hidden
          data-surface="invert"
          className="absolute inset-0 bg-gradient-to-t from-[rgb(var(--carbon-1000))]/70 via-[rgb(var(--carbon-1000))]/10 to-transparent"
        />
      )}
      {overlay === "grid" && <div aria-hidden className="absolute inset-0 bp-grid opacity-40" />}
      {frame === "corner" && <CornerFrame size={14} className="absolute inset-0 pointer-events-none" />}
      {children}
    </div>
  );
}

/** Non-manifest variant for ad-hoc frames around arbitrary content (not photography). */
export function MediaFrame({ aspect = "16/9", className, children }: { aspect?: string; className?: string; children: React.ReactNode }) {
  return (
    <div className={cn("relative overflow-hidden bg-[var(--surface-2)]", className)} style={{ aspectRatio: aspect }}>
      {children}
    </div>
  );
}
