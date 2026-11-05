"use client";

import { motion } from "framer-motion";

// Reduced motion is handled in CSS, not with useReducedMotion(): that hook is null on the server and the
// real OS setting on the client, so branching `initial` on it rendered different markup for the same
// tree and caused a hydration mismatch for anyone with reduced motion on. The `!` beats framer's inline
// opacity/transform, so these users see the content in place from the first paint, with no animation.
const REDUCED_MOTION = "motion-reduce:!opacity-100 motion-reduce:!transform-none";

/** Fade/slide in once as it enters the viewport. Renders in place under prefers-reduced-motion. */
export function Reveal({ children, delay = 0, className }: { children: React.ReactNode; delay?: number; className?: string }) {
  return (
    <motion.div
      className={className ? `${className} ${REDUCED_MOTION}` : REDUCED_MOTION}
      initial={{ opacity: 0, y: 24 }}
      whileInView={{ opacity: 1, y: 0 }}
      viewport={{ once: true, margin: "-80px" }}
      transition={{ duration: 0.6, delay, ease: [0.165, 0.84, 0.44, 1] }}
    >
      {children}
    </motion.div>
  );
}
