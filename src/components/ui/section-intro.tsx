import type { ReactNode } from "react";
import { Eyebrow } from "./technical";
import { Reveal } from "./reveal";
import { cn } from "@/lib/utils";

export interface SectionIntroProps {
  eyebrow?: ReactNode;
  /** Passed straight through to Eyebrow's numeric index slot, e.g. "01". */
  index?: string;
  headline: ReactNode;
  description?: ReactNode;
  /** Extra technical metadata row under the description (chips, SpecTable, etc.). */
  metadata?: ReactNode;
  align?: "left" | "center";
  className?: string;
}

/** Reusable editorial section header — "01 / MANUFACTURING" + large headline
 *  + short description. The one place every homepage section's intro should
 *  come from, so the rhythm (eyebrow → headline → description) never drifts
 *  section to section. */
export function SectionIntro({
  eyebrow,
  index,
  headline,
  description,
  metadata,
  align = "left",
  className,
}: SectionIntroProps) {
  const centered = align === "center";
  return (
    <Reveal className={cn(centered && "mx-auto text-center", className)}>
      <div className={cn(centered && "flex flex-col items-center")}>
        {eyebrow && (
          <Eyebrow index={index} className={cn("mb-3", centered && "justify-center")}>
            {eyebrow}
          </Eyebrow>
        )}
        <h2 className="font-display text-[clamp(28px,4vw,40px)] font-semibold leading-[1.1] tracking-[-0.01em] text-[var(--ink)]">
          {headline}
        </h2>
        {description && (
          <p className={cn("mt-3 max-w-2xl text-[19px] leading-[1.35] text-[var(--muted)]", centered && "mx-auto")}>
            {description}
          </p>
        )}
        {metadata && <div className="mt-6">{metadata}</div>}
      </div>
    </Reveal>
  );
}
