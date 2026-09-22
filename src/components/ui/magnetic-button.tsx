"use client";

import * as React from "react";
import { motion, useMotionValue, useSpring, useReducedMotion } from "framer-motion";
import { cn } from "@/lib/utils";

/** Fraction of the cursor's offset from center the element travels. */
const STRENGTH = 0.35;
/** Hard cap in px — keeps the pull subtle, not a gimmick. */
const MAX_OFFSET = 10;

/**
 * Wraps a Button/Link with a subtle cursor-attraction effect. Renders the
 * child completely unchanged — this is a positioning wrapper, not a prop
 * injector, so the wrapped element's click/keyboard/focus semantics are
 * untouched. Transform-only (translate via spring-smoothed motion values),
 * desktop-with-a-mouse only, off under reduced motion.
 */
export function MagneticButton({ children, className }: { children: React.ReactNode; className?: string }) {
  const ref = React.useRef<HTMLDivElement>(null);
  const reduceMotion = useReducedMotion();
  const [enabled, setEnabled] = React.useState(false);

  React.useEffect(() => {
    setEnabled(!reduceMotion && window.matchMedia("(pointer: fine)").matches);
  }, [reduceMotion]);

  const x = useMotionValue(0);
  const y = useMotionValue(0);
  const springX = useSpring(x, { stiffness: 300, damping: 20, mass: 0.4 });
  const springY = useSpring(y, { stiffness: 300, damping: 20, mass: 0.4 });

  const handleMove = (e: React.MouseEvent<HTMLDivElement>) => {
    if (!enabled || !ref.current) return;
    const rect = ref.current.getBoundingClientRect();
    const offsetX = e.clientX - (rect.left + rect.width / 2);
    const offsetY = e.clientY - (rect.top + rect.height / 2);
    x.set(Math.max(-MAX_OFFSET, Math.min(MAX_OFFSET, offsetX * STRENGTH)));
    y.set(Math.max(-MAX_OFFSET, Math.min(MAX_OFFSET, offsetY * STRENGTH)));
  };

  const handleLeave = () => {
    x.set(0);
    y.set(0);
  };

  return (
    <motion.div
      ref={ref}
      onMouseMove={handleMove}
      onMouseLeave={handleLeave}
      style={enabled ? { x: springX, y: springY } : undefined}
      className={cn("inline-block", enabled && "will-change-transform", className)}
    >
      {children}
    </motion.div>
  );
}
