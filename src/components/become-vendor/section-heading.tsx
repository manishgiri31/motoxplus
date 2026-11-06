import { cn } from "@/lib/utils";

/** Catalogue-style section label: red index + rule, then the heading. Shared by every section on the page. */
export function SectionHeading({
  index,
  eyebrow,
  title,
  lead,
  invert,
  id,
  className,
}: {
  index: string;
  eyebrow: string;
  title: string;
  lead?: string;
  invert?: boolean;
  id?: string;
  className?: string;
}) {
  return (
    <header className={cn("max-w-3xl", className)}>
      <p className="flex items-center gap-3 font-grotesk text-[13px] font-semibold uppercase tracking-[0.18em] text-mx-red">
        <span className="tabular-nums">{index}</span>
        <span aria-hidden className="h-px w-8 bg-current" />
        <span>{eyebrow}</span>
      </p>
      <h2
        id={id}
        className={cn(
          "mt-4 font-grotesk text-[clamp(28px,4vw,44px)] font-semibold leading-[1.08] tracking-[-0.025em]",
          invert ? "text-white" : "text-mx-black"
        )}
      >
        {title}
      </h2>
      {lead && <p className={cn("mt-4 max-w-2xl text-[17px] leading-relaxed", invert ? "text-white/70" : "text-[#4b4b52]")}>{lead}</p>}
    </header>
  );
}
