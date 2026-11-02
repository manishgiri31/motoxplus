"use client";

import { useEffect, useState } from "react";
import { ChevronDown } from "lucide-react";
import { cn } from "@/lib/utils";

export interface TocItem {
  id: string;
  title: string;
}

// Sticky header is h-14 (56px) and sections use scroll-mt-24 (96px), so a
// section jumped to via the contents lands at 96px. Count it as "current"
// a little before that so it never sits on the boundary.
const ACTIVE_OFFSET = 128;

/**
 * Table of contents for long legal documents. Sticky list beside the text on
 * desktop; a collapsible "Contents" disclosure above it on phones. The
 * current section is tracked from scroll position so the reader always knows
 * where they are in a 20-section document.
 */
export function LegalToc({ items }: { items: TocItem[] }) {
  const [activeId, setActiveId] = useState<string | null>(null);
  const [open, setOpen] = useState(false);

  useEffect(() => {
    let frame = 0;
    const update = () => {
      frame = 0;
      let current: string | null = null;
      for (const { id } of items) {
        const el = document.getElementById(id);
        if (el && el.getBoundingClientRect().top <= ACTIVE_OFFSET) current = id;
      }
      // The last sections are too short to ever reach the top of the viewport.
      const atBottom = window.innerHeight + window.scrollY >= document.documentElement.scrollHeight - 4;
      if (atBottom && items.length) current = items[items.length - 1].id;
      setActiveId(current);
    };
    const onScroll = () => {
      if (!frame) frame = requestAnimationFrame(update);
    };
    // Landing on /terms#section: the browser's own anchor jump is undone when
    // the app router restores scroll after navigation, so do it again here.
    const hash = decodeURIComponent(window.location.hash.slice(1));
    if (hash) document.getElementById(hash)?.scrollIntoView();
    update();
    window.addEventListener("scroll", onScroll, { passive: true });
    window.addEventListener("resize", onScroll);
    return () => {
      window.removeEventListener("scroll", onScroll);
      window.removeEventListener("resize", onScroll);
      if (frame) cancelAnimationFrame(frame);
    };
  }, [items]);

  const list = (
    <ol className="-mx-2.5 space-y-0.5">
      {items.map((item, i) => {
        const active = item.id === activeId;
        return (
          <li key={item.id}>
            <a
              href={`#${item.id}`}
              aria-current={active ? "location" : undefined}
              onClick={() => setOpen(false)}
              className={cn(
                "flex gap-2.5 rounded-lg px-2.5 py-2 text-14 transition-colors bp-lg:py-1.5",
                active ? "bg-store-bg-alt font-semibold text-store-ink" : "text-store-ink-2 hover:text-store-ink",
              )}
            >
              <span className="tnum w-5 shrink-0 text-right text-store-ink-3">{i + 1}</span>
              <span>{item.title}</span>
            </a>
          </li>
        );
      })}
    </ol>
  );

  return (
    <nav aria-label="Contents" className="print:hidden">
      {/* Phones / tablets */}
      <div className="rounded-store-card bg-store-bg-alt bp-lg:hidden">
        <button
          type="button"
          aria-expanded={open}
          aria-controls="legal-toc-list"
          onClick={() => setOpen((v) => !v)}
          className="flex min-h-12 w-full items-center justify-between px-5 text-left text-17 font-semibold"
        >
          Contents
          <ChevronDown size={20} aria-hidden className={cn("text-store-ink-2 transition-transform", open && "rotate-180")} />
        </button>
        <div id="legal-toc-list" hidden={!open} className="px-2 pb-3">
          {list}
        </div>
      </div>

      {/* Desktop */}
      <div className="sticky top-24 hidden max-h-[calc(100vh-8rem)] overflow-y-auto bp-lg:block">
        <p className="mb-2 text-12 font-semibold uppercase tracking-[0.08em] text-store-ink-3">Contents</p>
        {list}
      </div>
    </nav>
  );
}
