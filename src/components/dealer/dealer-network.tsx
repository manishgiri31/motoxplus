"use client";

import { motion, useReducedMotion } from "framer-motion";
import { MetricCounter } from "@/components/ui/metric-counter";
import { BlueprintGrid, CornerFrame } from "@/components/ui/technical";
import { cn } from "@/lib/utils";

export interface DealerNetworkStats {
  dealerCount: number;
  stateCount: number;
}

interface Node {
  x: number;
  y: number;
}

// A loose node field, not a traced map of India — deliberately abstract so
// it never implies per-state precision the backend doesn't provide. Index 0
// is the hub (MotoXPlus) that every connection radiates from.
const NODES: Node[] = [
  { x: 50, y: 10 },
  { x: 24, y: 24 },
  { x: 74, y: 20 },
  { x: 12, y: 48 },
  { x: 42, y: 36 },
  { x: 64, y: 42 },
  { x: 88, y: 46 },
  { x: 30, y: 64 },
  { x: 56, y: 60 },
  { x: 78, y: 68 },
  { x: 18, y: 82 },
  { x: 46, y: 88 },
  { x: 68, y: 90 },
  { x: 90, y: 80 },
  { x: 8, y: 66 },
];
const HUB = 0;

/**
 * Visually communicates a distribution network — animated connection points
 * radiating from a hub — without claiming to be a geographically accurate
 * map or implying dealer counts by state we don't have. Stats are supplied
 * by the caller, never hardcoded here.
 */
export function DealerNetwork({ stats, className }: { stats: DealerNetworkStats; className?: string }) {
  const reduceMotion = useReducedMotion();

  return (
    <div className={cn("relative", className)}>
      <div className="relative mx-auto aspect-[4/5] max-w-md overflow-hidden">
        <BlueprintGrid fade="radial" className="opacity-50" />
        <svg
          viewBox="0 0 100 100"
          className="absolute inset-0 h-full w-full"
          role="img"
          aria-label={`MotoXPlus dealer network — ${stats.dealerCount}+ dealer partners across ${stats.stateCount}+ states in India`}
        >
          {NODES.map(
            (node, i) =>
              i !== HUB && (
                <motion.line
                  key={`line-${i}`}
                  x1={NODES[HUB].x}
                  y1={NODES[HUB].y}
                  x2={node.x}
                  y2={node.y}
                  stroke="var(--red)"
                  strokeWidth={0.25}
                  initial={reduceMotion ? { pathLength: 1, opacity: 0.35 } : { pathLength: 0, opacity: 0 }}
                  whileInView={{ pathLength: 1, opacity: 0.35 }}
                  viewport={{ once: true, margin: "-80px" }}
                  transition={{ duration: 1, delay: 0.15 + i * 0.04, ease: [0.16, 1, 0.3, 1] }}
                />
              )
          )}
          {NODES.map((node, i) => (
            <motion.circle
              key={`node-${i}`}
              cx={node.x}
              cy={node.y}
              r={i === HUB ? 2.2 : 1.1}
              fill={i === HUB ? "var(--red)" : "var(--ink)"}
              initial={reduceMotion ? { opacity: 1, scale: 1 } : { opacity: 0, scale: 0 }}
              whileInView={{ opacity: 1, scale: 1 }}
              viewport={{ once: true, margin: "-80px" }}
              transition={{ duration: 0.4, delay: i === HUB ? 0 : 0.5 + i * 0.04 }}
            />
          ))}
          {!reduceMotion && (
            <motion.circle
              cx={NODES[HUB].x}
              cy={NODES[HUB].y}
              r={2.2}
              fill="none"
              stroke="var(--red)"
              strokeWidth={0.4}
              initial={{ opacity: 0.6, scale: 1 }}
              animate={{ opacity: 0, scale: 2.6 }}
              transition={{ duration: 2.2, repeat: Infinity, ease: "easeOut" }}
            />
          )}
        </svg>
        <CornerFrame size={16} className="pointer-events-none absolute inset-0" />
      </div>

      <div className="mt-8 flex items-center justify-center gap-10">
        <MetricCounter value={stats.dealerCount} suffix="+" label="Dealer Partners" />
        <div aria-hidden className="h-10 w-px bg-[var(--line)]" />
        <MetricCounter value={stats.stateCount} suffix="+" label="States Covered" />
      </div>
    </div>
  );
}
