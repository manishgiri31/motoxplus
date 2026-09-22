import type { ReactNode } from "react";
import { MediaSlot } from "./media";
import { VideoPlate } from "./video-plate";
import { Reveal } from "./reveal";
import { media as getMedia, type MediaSlotId } from "@/lib/media";
import { cn } from "@/lib/utils";

export interface MediaHeroProps {
  /** Slot id from src/lib/media.ts — video or image, resolved automatically. */
  media: MediaSlotId;
  eyebrow?: ReactNode;
  headline: ReactNode;
  description?: ReactNode;
  /** CTA buttons — rendered as-is, in a row on desktop / stacked on mobile. */
  actions?: ReactNode;
  /** e.g. a StatStrip or TechnicalLabel row, anchored under the main content block. */
  metadata?: ReactNode;
  align?: "start" | "center";
  className?: string;
}

/**
 * Reusable cinematic hero: full-viewport background media (through
 * VideoPlate/MediaSlot — never a raw <video>/<img>) + scrim + editorial
 * text block. `100svh` (not `100vh`) so mobile browser chrome doesn't clip
 * content. Top padding reserves space for the fixed transparent-over-hero
 * nav (see globals.css --nav-h/--nav-h-lg) without hardcoding its height twice.
 */
export function MediaHero({ media, eyebrow, headline, description, actions, metadata, align = "start", className }: MediaHeroProps) {
  const asset = getMedia(media);

  return (
    <section
      data-surface="invert"
      className={cn(
        "relative flex min-h-[100svh] w-full flex-col overflow-hidden bg-[rgb(var(--carbon-1000))] text-white",
        className
      )}
    >
      <div className="absolute inset-0">
        {asset.kind === "video" ? (
          <VideoPlate id={media} controls="minimal" className="h-full w-full" />
        ) : (
          <MediaSlot id={media} sizes="100vw" priority className="h-full w-full" fit="cover" />
        )}
        <div aria-hidden className="absolute inset-0 bg-gradient-to-t from-black/85 via-black/35 to-black/55" />
      </div>

      <div
        className={cn(
          "relative z-[1] flex flex-1 flex-col px-4 pb-10 md:px-8 md:pb-16",
          "pt-[calc(var(--nav-h)+2.5rem)] md:pt-[calc(var(--nav-h-lg)+3rem)]",
          align === "center" ? "items-center justify-center text-center" : "justify-end"
        )}
      >
        <div className={cn("max-w-3xl", align === "center" && "mx-auto")}>
          {eyebrow && (
            <Reveal>
              <div className="mb-5 text-white/70">{eyebrow}</div>
            </Reveal>
          )}
          <Reveal delay={0.08}>
            <h1 className="font-display text-4xl font-bold leading-[1.03] tracking-tight md:text-6xl lg:text-7xl">
              {headline}
            </h1>
          </Reveal>
          {description && (
            <Reveal delay={0.16}>
              <p className="mt-6 max-w-xl text-base leading-relaxed text-white/75 md:text-lg">{description}</p>
            </Reveal>
          )}
          {actions && (
            <Reveal delay={0.24}>
              <div className="mt-9 flex flex-col items-start gap-3 sm:flex-row">{actions}</div>
            </Reveal>
          )}
        </div>

        {metadata && (
          <Reveal delay={0.32} className="mt-12 md:mt-16">
            {metadata}
          </Reveal>
        )}
      </div>
    </section>
  );
}
