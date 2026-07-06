"use client";

import { useRef, useState, type PointerEvent } from "react";
import Image from "next/image";

const PX_PER_FRAME = 8;

export function Spin360Viewer({ frameUrls }: { frameUrls: string[] }) {
  const [frameIndex, setFrameIndex] = useState(0);
  const dragging = useRef(false);
  const lastX = useRef(0);
  const frameCount = frameUrls.length;

  function onPointerDown(e: PointerEvent<HTMLDivElement>) {
    dragging.current = true;
    lastX.current = e.clientX;
    e.currentTarget.setPointerCapture(e.pointerId);
  }

  function onPointerMove(e: PointerEvent<HTMLDivElement>) {
    if (!dragging.current) return;
    const delta = e.clientX - lastX.current;
    if (Math.abs(delta) < PX_PER_FRAME) return;
    const framesToMove = Math.round(delta / PX_PER_FRAME);
    setFrameIndex((i) => ((i - framesToMove) % frameCount + frameCount) % frameCount);
    lastX.current = e.clientX;
  }

  function onPointerUp() {
    dragging.current = false;
  }

  if (frameCount === 0) return null;

  return (
    <div
      className="relative w-full h-[360px] md:h-[440px] rounded-2xl overflow-hidden glass border border-[var(--border-color)] bg-[var(--bg-secondary)] cursor-grab active:cursor-grabbing select-none touch-none"
      onPointerDown={onPointerDown}
      onPointerMove={onPointerMove}
      onPointerUp={onPointerUp}
      onPointerLeave={onPointerUp}
    >
      <Image
        src={frameUrls[frameIndex]}
        alt={`360 view frame ${frameIndex + 1}`}
        fill
        className="object-contain pointer-events-none"
        unoptimized
        priority
      />
      <div className="absolute bottom-3 left-1/2 -translate-x-1/2 text-[10px] uppercase tracking-widest font-semibold text-[var(--text-muted)] bg-[var(--bg-primary)]/70 px-2.5 py-1 rounded-full">
        Drag to rotate — {frameIndex + 1}/{frameCount}
      </div>
    </div>
  );
}
