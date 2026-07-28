"use client";

import * as React from "react";
import { Play, Pause } from "lucide-react";
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
  controls?: "minimal" | "full" | "none";
  caption?: string;
  className?: string;
}

/**
 * globals.css's reduced-motion block stops CSS animations/transitions but has
 * NO effect on `<video autoplay>` — this component's own matchMedia gate is
 * what actually satisfies prefers-reduced-motion for video. It also always
 * renders a visible pause control when autoplaying (WCAG 2.2.2 — auto-playing
 * content beyond 5s needs one) and pauses on tab blur.
 */
export function VideoPlate({ id, autoplay = true, loop = true, controls = "minimal", caption, className }: VideoPlateProps) {
  const asset = getMedia(id);
  const videoRef = React.useRef<HTMLVideoElement>(null);
  const containerRef = React.useRef<HTMLDivElement>(null);
  const [playing, setPlaying] = React.useState(false);
  const [current, setCurrent] = React.useState(0);
  const [duration, setDuration] = React.useState(0);

  // controls="none" is only valid when autoplay is off — an auto-playing,
  // uncontrollable video is an accessibility dead end. Assert in dev.
  if (process.env.NODE_ENV !== "production" && autoplay && controls === "none") {
    console.error(`VideoPlate(${id}): controls="none" is not allowed together with autoplay.`);
  }

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

  const togglePlay = () => {
    const el = videoRef.current;
    if (!el) return;
    if (el.paused) el.play().catch(() => {});
    else el.pause();
  };

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
        onPlay={() => setPlaying(true)}
        onPause={() => setPlaying(false)}
        onTimeUpdate={(e) => setCurrent(e.currentTarget.currentTime)}
        onLoadedMetadata={(e) => setDuration(e.currentTarget.duration)}
      >
        <source src={asset.src as string} />
      </video>

      {controls !== "none" && (
        <div className="absolute inset-x-0 bottom-0 flex items-center justify-between gap-3 p-4">
          <button
            type="button"
            onClick={togglePlay}
            aria-label={playing ? "Pause video" : "Play video"}
            className="flex h-9 w-9 items-center justify-center rounded-full bg-white/10 text-white backdrop-blur-sm transition-colors hover:bg-white/20 focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-[var(--focus-ring)]"
          >
            {playing ? <Pause size={15} /> : <Play size={15} className="ml-0.5" />}
          </button>
          {controls === "full" && (
            <span className="tnum text-[10px] text-white/70">
              <Numeral value={formatTime(current)} /> / <Numeral value={formatTime(duration)} />
            </span>
          )}
        </div>
      )}

      <CornerFrame size={14} className="absolute inset-0 pointer-events-none" />
      {caption && (
        <p className="absolute left-4 top-4 text-[10px] font-semibold uppercase tracking-eyebrow text-white/70">{caption}</p>
      )}
    </div>
  );
}
