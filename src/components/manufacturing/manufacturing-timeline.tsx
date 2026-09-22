"use client";

import * as React from "react";
import { AnimatePresence, motion, useReducedMotion } from "framer-motion";
import { ManufacturingStage, type ManufacturingStageData } from "./manufacturing-stage";
import { MediaSlot } from "@/components/ui/media";
import { VideoPlate } from "@/components/ui/video-plate";
import { CornerFrame, TechnicalLabel } from "@/components/ui/technical";
import { media as getMedia } from "@/lib/media";
import { cn } from "@/lib/utils";

export interface ManufacturingTimelineProps {
  stages: ManufacturingStageData[];
  className?: string;
}

function StageMedia({ stage }: { stage: ManufacturingStageData }) {
  const asset = getMedia(stage.media);
  return asset.kind === "video" ? (
    <VideoPlate id={stage.media} />
  ) : (
    <MediaSlot id={stage.media} sizes="(min-width: 1024px) 45vw, 100vw" fit="cover" />
  );
}

/**
 * Desktop: a sticky media panel crossfades as the reader scrolls past a
 * left-hand list of stages; the active stage is driven by an
 * IntersectionObserver watching a thin band at viewport-middle (no scroll
 * listener, no per-frame layout writes). Mobile: a plain vertical stack,
 * each stage with its own inline media — no sticky/observer logic needed
 * since there's nothing to keep in sync.
 */
export function ManufacturingTimeline({ stages, className }: ManufacturingTimelineProps) {
  const [activeIndex, setActiveIndex] = React.useState(0);
  const rowRefs = React.useRef<(HTMLDivElement | null)[]>([]);
  const reduceMotion = useReducedMotion();

  React.useEffect(() => {
    const observer = new IntersectionObserver(
      (entries) => {
        entries.forEach((entry) => {
          if (!entry.isIntersecting) return;
          const index = Number(entry.target.getAttribute("data-stage-index"));
          if (!Number.isNaN(index)) setActiveIndex(index);
        });
      },
      { rootMargin: "-45% 0px -45% 0px", threshold: 0 }
    );
    rowRefs.current.forEach((el) => el && observer.observe(el));
    return () => observer.disconnect();
  }, [stages.length]);

  const activeStage = stages[activeIndex];
  if (!activeStage) return null;

  return (
    <div className={cn("relative", className)}>
      {/* Desktop */}
      <div className="hidden lg:grid lg:grid-cols-2 lg:gap-16">
        <div>
          {stages.map((stage, i) => (
            <div
              key={stage.number}
              ref={(el) => {
                rowRefs.current[i] = el;
              }}
              data-stage-index={i}
            >
              <ManufacturingStage stage={stage} active={i === activeIndex} onSelect={() => setActiveIndex(i)} />
            </div>
          ))}
        </div>

        <div className="sticky top-28 self-start">
          <div className="relative overflow-hidden">
            <AnimatePresence mode="wait">
              <motion.div
                key={activeStage.number}
                initial={reduceMotion ? { opacity: 1 } : { opacity: 0 }}
                animate={{ opacity: 1 }}
                exit={reduceMotion ? { opacity: 1 } : { opacity: 0 }}
                transition={{ duration: 0.35, ease: [0.16, 1, 0.3, 1] }}
              >
                <StageMedia stage={activeStage} />
              </motion.div>
            </AnimatePresence>
            <CornerFrame size={16} className="pointer-events-none absolute inset-0" />
            <TechnicalLabel invert className="absolute left-4 top-4">
              Process / {activeStage.number} of {String(stages.length).padStart(2, "0")}
            </TechnicalLabel>
          </div>

          <div className="mt-4 flex gap-1.5" role="progressbar" aria-valuenow={activeIndex + 1} aria-valuemin={1} aria-valuemax={stages.length}>
            {stages.map((stage, i) => (
              <span
                key={stage.number}
                className={cn(
                  "h-[3px] flex-1 rounded-full transition-colors duration-300",
                  i === activeIndex ? "bg-[var(--red)]" : "bg-[var(--line)]"
                )}
              />
            ))}
          </div>
        </div>
      </div>

      {/* Mobile / tablet */}
      <div className="flex flex-col gap-12 lg:hidden">
        {stages.map((stage) => (
          <div key={stage.number}>
            <div className="relative mb-5">
              <StageMedia stage={stage} />
              <CornerFrame size={14} className="pointer-events-none absolute inset-0" />
            </div>
            <ManufacturingStage stage={stage} active />
          </div>
        ))}
      </div>
    </div>
  );
}

export type { ManufacturingStageData };
