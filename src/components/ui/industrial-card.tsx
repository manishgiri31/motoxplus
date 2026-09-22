import type { ReactNode } from "react";
import Link from "next/link";
import { ArrowRight } from "lucide-react";
import { Card } from "./card";
import { Eyebrow } from "./technical";
import { cn } from "@/lib/utils";
import type { Tone } from "@/lib/status";

export interface IndustrialCardProps {
  /** Typically a MediaSlot/Img/VideoPlate element — bleeds to the card's edges. */
  media?: ReactNode;
  eyebrow?: ReactNode;
  index?: string;
  title: ReactNode;
  description?: ReactNode;
  /** e.g. a TechnicalLabel row or SpecTable — rendered above the CTA. */
  metadata?: ReactNode;
  href?: string;
  ctaLabel?: string;
  tone?: Tone;
  className?: string;
}

/** A composed Card + technical.tsx treatment — square corners, accent keyline,
 *  eyebrow/title/description rhythm. Use only where a card is genuinely the
 *  right device (a category tile, a process step); it is not a generic
 *  content-box replacement. */
export function IndustrialCard({
  media,
  eyebrow,
  index,
  title,
  description,
  metadata,
  href,
  ctaLabel = "Explore",
  tone,
  className,
}: IndustrialCardProps) {
  const content = (
    <Card
      edge={tone ? "tone" : "accent"}
      tone={tone}
      interactive={!!href}
      pad="lg"
      className={cn("group h-full rounded-none", className)}
    >
      {media && <div className="-mx-6 -mt-6 mb-6">{media}</div>}
      {eyebrow && (
        <Eyebrow index={index} className="mb-4">
          {eyebrow}
        </Eyebrow>
      )}
      <h3 className="mb-2 font-display text-xl font-bold tracking-tight text-[var(--ink)]">{title}</h3>
      {description && <p className="mb-4 text-sm leading-relaxed text-[var(--muted)]">{description}</p>}
      {metadata}
      {href && (
        <span className="mt-4 inline-flex items-center gap-2 text-xs font-bold uppercase tracking-wider text-[var(--red)]">
          {ctaLabel}
          <ArrowRight size={13} className="transition-transform group-hover:translate-x-0.5" />
        </span>
      )}
    </Card>
  );

  return href ? (
    <Link href={href} className="block h-full">
      {content}
    </Link>
  ) : (
    content
  );
}
