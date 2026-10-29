"use client";

import { useRef } from "react";
import { ChevronLeft, ChevronRight } from "lucide-react";
import { useReducedMotion } from "framer-motion";

const arrow =
  "grid h-11 w-11 place-items-center rounded-full bg-black/[.08] text-black/[.56] transition-colors duration-base ease-apple hover:bg-black/[.16] focus-visible:outline-store-accent";

/** Snap scroller. Wrap each child in <ScrollerItem>. Keyboard-scrollable region with labelled arrows; never auto-advances. */
export function CardScroller({ label, children }: { label: string; children: React.ReactNode }) {
  const ref = useRef<HTMLDivElement>(null);
  const reduce = useReducedMotion();
  const scroll = (dir: 1 | -1) =>
    ref.current?.scrollBy({ left: dir * ref.current.clientWidth * 0.8, behavior: reduce ? "auto" : "smooth" });

  return (
    <div>
      <div className="relative">
        <div
          ref={ref}
          tabIndex={0}
          role="region"
          aria-label={label}
          className="flex snap-x snap-mandatory gap-4 overflow-x-auto px-6 pb-4 [scrollbar-width:none] [&::-webkit-scrollbar]:hidden focus-visible:outline-store-accent"
        >
          {children}
        </div>
        <div
          aria-hidden
          className="pointer-events-none absolute inset-y-0 right-0 w-12 bg-gradient-to-r from-[#ffffff00] to-white"
        />
      </div>
      <div className="mt-4 flex justify-end gap-2 px-6">
        <button type="button" onClick={() => scroll(-1)} aria-label="Previous products" className={arrow}>
          <ChevronLeft size={18} />
        </button>
        <button type="button" onClick={() => scroll(1)} aria-label="Next products" className={arrow}>
          <ChevronRight size={18} />
        </button>
      </div>
    </div>
  );
}

export function ScrollerItem({ children }: { children: React.ReactNode }) {
  return <div className="flex shrink-0 basis-[min(80%,340px)] snap-start">{children}</div>;
}
