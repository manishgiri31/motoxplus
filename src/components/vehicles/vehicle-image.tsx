"use client";

import { useEffect, useState } from "react";
import Image from "next/image";
import { ImageOff } from "lucide-react";
import { cn } from "@/lib/utils";

interface Props {
  src?: string | null;
  alt: string;
  sizes?: string;
  className?: string;
  /** Identifier logged to the console when the image is missing, so gaps can be tracked and filled later. */
  logId?: string;
  /** Above-the-fold hero usage — loads eagerly instead of lazily. */
  priority?: boolean;
}

const DEFAULT_SIZES = "(max-width: 768px) 100vw, (max-width: 1200px) 50vw, 25vw";

export function VehicleImage({ src, alt, sizes, className, logId, priority }: Props) {
  const [loaded, setLoaded] = useState(false);
  const [errored, setErrored] = useState(false);
  const showPlaceholder = !src || errored;

  useEffect(() => {
    if (showPlaceholder) {
      console.warn(`[VehicleImage] Missing image${logId ? ` for "${logId}"` : ""} — showing placeholder.`);
    }
  }, [showPlaceholder, logId]);

  if (showPlaceholder) {
    return (
      <div className="absolute inset-0 flex flex-col items-center justify-center gap-2 bg-gradient-to-br from-[var(--bg-secondary)] to-[var(--bg-primary)]">
        <ImageOff size={28} className="text-[var(--text-muted)]/40" />
        <span className="text-[var(--text-muted)] text-[10px] uppercase tracking-widest font-semibold">
          Image Coming Soon
        </span>
      </div>
    );
  }

  return (
    <Image
      src={src}
      alt={alt}
      fill
      priority={priority}
      loading={priority ? undefined : "lazy"}
      onLoad={() => setLoaded(true)}
      onError={() => setErrored(true)}
      sizes={sizes ?? DEFAULT_SIZES}
      className={cn(
        "object-contain transition-opacity duration-300",
        loaded ? "opacity-100" : "opacity-0",
        className
      )}
    />
  );
}
