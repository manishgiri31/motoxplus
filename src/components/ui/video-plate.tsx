"use client";

import * as React from "react";
import { cn } from "@/lib/utils";
import { media as getMedia, isPending, type MediaSlotId } from "@/lib/media";
import { CornerFrame } from "./technical";
import { Numeral } from "./numeral";

// Minimal typing for the non-standard Network Information API — no @types
// package covers it, and it's read defensively (optional chaining) below.
interface NetworkInformation {
  saveData?: boolean;
  effectiveType?: "slow-2g" | "2g" | "3g" | "4g";
}

function canAutoplay(): boolean {
  if (typeof window === "undefined") return false;
  if (!window.matchMedia("(prefers-reduced-motion: no-preference)").matches) return false;
  const conn = (navigator as Navigator & { connection?: NetworkInformation }).connection;
  if (conn?.saveData) return false;
  if (conn?.effectiveType === "2g" || conn?.effectiveType === "slow-2g") return false;
  return true;
}

function formatTime(seconds: number): string {
  if (!Number.isFinite(seconds)) return "00:00";
  const m = Math.floor(seconds / 60);
  const s = Math.floor(seconds % 60);
  return `${String(m).padStart(2, "0")}:${String(s).padStart(2, "0")}`;
}

export interface VideoPlateProps {
  id: MediaSlotId;
  autoplay?: boolean;
  loop?: boolean;
  controls?: "full" | "none";
  caption?: string;
  className?: string;
}

/**
 * globals.css's reduced-motion block stops CSS animations/transitions but has
 * NO effect on `<video autoplay>` — this component's own matchMedia gate is
 * what actually satisfies prefers-reduced-motion for video (it still pauses
 * on tab blur and for reduced-motion/save-data users; there's just no manual
 * play/pause affordance in the UI).
 */
export function VideoPlate({ id, autoplay = true, loop = true, controls = "none", caption, className }: VideoPlateProps) {
  const asset = getMedia(id);
  const videoRef = React.useRef<HTMLVideoElement>(null);
  const containerRef = React.useRef<HTMLDivElement>(null);
  const [current, setCurrent] = React.useState(0);
  const [duration, setDuration] = React.useState(0);

  React.useEffect(() => {
    const el = videoRef.current;
    const container = containerRef.current;
    if (!el || !container || isPending(asset) || !autoplay) return;

    let observer: IntersectionObserver | undefined;
    if (canAutoplay()) {
      observer = new IntersectionObserver(
        ([entry]) => {
          if (entry.isIntersecting) {
            el.play().catch(() => {});
          } else {
            el.pause();
          }
        },
        { threshold: 0.25 }
      );
      observer.observe(container);
    }

    const onVisibility = () => {
      if (document.hidden) el.pause();
      else if (canAutoplay()) el.play().catch(() => {});
    };
    document.addEventListener("visibilitychange", onVisibility);

    return () => {
      observer?.disconnect();
      document.removeEventListener("visibilitychange", onVisibility);
    };
  }, [asset, autoplay]);

  if (isPending(asset)) {
    return (
      <div
        className={cn("relative flex items-center justify-center overflow-hidden bg-[var(--surface-2)] bp-grid", className)}
        style={{ aspectRatio: asset.aspect }}
      >
        <CornerFrame size={12} className="absolute inset-3" />
        <span className="text-[10px] font-semibold uppercase tracking-eyebrow text-[var(--text-muted)]">
          Footage pending — {asset.aspect}
        </span>
      </div>
    );
  }

  return (
    <div
      ref={containerRef}
      data-surface="invert"
      className={cn("relative overflow-hidden bg-[rgb(var(--carbon-1000))]", className)}
      style={{ aspectRatio: asset.aspect }}
    >
      <video
        ref={videoRef}
        muted
        playsInline
        loop={loop}
        preload="metadata"
        poster={asset.poster ?? undefined}
        className="absolute inset-0 h-full w-full object-cover"
        onTimeUpdate={(e) => setCurrent(e.currentTarget.currentTime)}
        onLoadedMetadata={(e) => setDuration(e.currentTarget.duration)}
      >
        <source src={asset.src as string} />
      </video>

      {controls === "full" && (
        <div className="absolute inset-x-0 bottom-0 flex items-center justify-end p-4">
          <span className="tnum text-[10px] text-white/70">
            <Numeral value={formatTime(current)} /> / <Numeral value={formatTime(duration)} />
          </span>
        </div>
      )}

      <CornerFrame size={14} className="absolute inset-0 pointer-events-none" />
      {caption && (
        <p className="absolute left-4 top-4 text-[10px] font-semibold uppercase tracking-eyebrow text-white/70">{caption}</p>
      )}
    </div>
  );
}
