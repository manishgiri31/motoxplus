"use client";

import { useState } from "react";
import Image from "next/image";
import Link from "next/link";

interface Hotspot {
  id: string;
  x: number;
  y: number;
  label: string;
  calloutNumber: number | null;
  productId: string | null;
}

interface Diagram {
  id: string;
  name: string;
  imageUrl: string;
  hotspots: Hotspot[];
}

function HotspotMarker({ hotspot }: { hotspot: Hotspot }) {
  const [hovered, setHovered] = useState(false);
  const marker = (
    <span className="w-7 h-7 rounded-full bg-red-600 text-white text-xs font-bold flex items-center justify-center border-2 border-white/80 shadow-lg hover:scale-110 transition-transform cursor-pointer">
      {hotspot.calloutNumber ?? "•"}
    </span>
  );

  return (
    <div
      className="absolute -translate-x-1/2 -translate-y-1/2"
      style={{ left: `${hotspot.x}%`, top: `${hotspot.y}%` }}
      onMouseEnter={() => setHovered(true)}
      onMouseLeave={() => setHovered(false)}
    >
      {hotspot.productId ? <Link href={`/products/${hotspot.productId}`}>{marker}</Link> : marker}
      {hovered && (
        <span className="absolute left-1/2 -translate-x-1/2 bottom-full mb-2 whitespace-nowrap bg-[var(--bg-primary)] border border-[var(--border-color)] text-[var(--text-primary)] text-xs font-semibold px-2.5 py-1 rounded-lg shadow-xl z-10">
          {hotspot.label}
        </span>
      )}
    </div>
  );
}

export function PartsDiagram({ diagrams }: { diagrams: Diagram[] }) {
  const [activeId, setActiveId] = useState(diagrams[0]?.id);
  const active = diagrams.find((d) => d.id === activeId) ?? diagrams[0];
  if (!active) return null;

  return (
    <div className="space-y-4">
      {diagrams.length > 1 && (
        <div className="flex flex-wrap gap-2">
          {diagrams.map((d) => (
            <button
              key={d.id}
              onClick={() => setActiveId(d.id)}
              className={`px-3 py-1.5 rounded-full text-xs font-semibold border transition-colors ${
                activeId === d.id
                  ? "bg-red-600 border-red-600 text-white"
                  : "border-[var(--border-color)] text-[var(--text-muted)] hover:text-red-500"
              }`}
            >
              {d.name}
            </button>
          ))}
        </div>
      )}
      <div className="relative w-full rounded-2xl overflow-hidden glass border border-[var(--border-color)] bg-[var(--bg-secondary)]">
        <div className="relative w-full" style={{ paddingTop: "60%" }}>
          <Image src={active.imageUrl} alt={active.name} fill className="object-contain" unoptimized />
          {active.hotspots.map((h) => (
            <HotspotMarker key={h.id} hotspot={h} />
          ))}
        </div>
      </div>
    </div>
  );
}
