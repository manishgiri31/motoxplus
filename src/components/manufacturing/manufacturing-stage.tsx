import { cn } from "@/lib/utils";
import type { MediaSlotId } from "@/lib/media";

export interface ManufacturingStageData {
  /** "01", "02", ... — display only, not used as a React key by the consumer's list. */
  number: string;
  title: string;
  eyebrow?: string;
  description: string;
  media: MediaSlotId;
}

export interface ManufacturingStageProps {
  stage: ManufacturingStageData;
  active?: boolean;
  /** Present -> renders as a clickable/keyboard-focusable <button> (desktop nav use). Absent -> plain <div> (mobile stack use). */
  onSelect?: () => void;
  className?: string;
}

/** One stage's text content — number, eyebrow, title, description. Media is
 *  handled by the parent (ManufacturingTimeline), not here, since desktop
 *  shows it in a separate sticky panel while mobile shows it inline. */
export function ManufacturingStage({ stage, active, onSelect, className }: ManufacturingStageProps) {
  const interactive = !!onSelect;
  const Comp = interactive ? "button" : "div";

  return (
    <Comp
      type={interactive ? "button" : undefined}
      onClick={onSelect}
      aria-current={interactive ? (active ? "true" : undefined) : undefined}
      className={cn(
        "w-full border-l-2 py-5 pl-5 text-left transition-colors duration-[var(--dur-2)]",
        active ? "border-[var(--red)]" : "border-[var(--line)]",
        interactive && !active && "hover:border-[var(--muted)]",
        className
      )}
    >
      <div className="flex items-baseline gap-3">
        <span
          className={cn(
            "tnum font-mono text-xs font-bold transition-colors",
            active ? "text-[var(--red)]" : "text-[var(--muted)]"
          )}
        >
          {stage.number}
        </span>
        {stage.eyebrow && (
          <span className="text-[10px] uppercase tracking-eyebrow text-[var(--muted)]">{stage.eyebrow}</span>
        )}
      </div>
      <h3
        className={cn(
          "mt-1.5 font-display text-lg font-bold transition-colors md:text-xl",
          active ? "text-[var(--ink)]" : "text-[var(--muted)]"
        )}
      >
        {stage.title}
      </h3>
      <p className="mt-2 max-w-sm text-sm leading-relaxed text-[var(--muted)]">{stage.description}</p>
    </Comp>
  );
}
