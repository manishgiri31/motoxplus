"use client";

import * as React from "react";
import Image from "next/image";
import { ImagePlus, Star, Trash2 } from "lucide-react";
import { Spinner } from "@/components/ui/spinner";
import { cn } from "@/lib/utils";
import {
  IMAGE_ACCEPT,
  makePrimaryImage,
  photoProblem,
  removeListingImage,
  uploadListingImage,
  type Listing,
  type ListingImage,
} from "@/lib/vendor/listings";
import { messageFrom } from "./errors";

/**
 * Up to `max` photos per listing. The first is the primary photo (search results, catalogue grid). Files are checked
 * here for size and type so mistakes show at once; the Java API re-checks the actual bytes. Uploads go one at a time
 * so a slow connection never has several large requests in flight.
 */
export function PhotoManager({
  listingId,
  images,
  max,
  error,
  disabled,
  onChange,
}: {
  /** null while the listing has not been saved yet: photos need a listing to belong to. */
  listingId: string | null;
  images: ListingImage[];
  max: number;
  error?: string;
  disabled?: boolean;
  onChange: (listing: Listing) => void;
}) {
  const inputRef = React.useRef<HTMLInputElement>(null);
  const [queue, setQueue] = React.useState<string[]>([]);
  const [problems, setProblems] = React.useState<string[]>([]);
  const [busyId, setBusyId] = React.useState<string | null>(null);
  const [dragging, setDragging] = React.useState(false);
  const uploading = queue.length > 0;
  const room = max - images.length;
  const canAdd = !!listingId && !disabled && room > 0 && !uploading;

  async function addFiles(list: FileList | File[]) {
    if (!listingId) return;
    const files = Array.from(list);
    const notes: string[] = [];
    const accepted: File[] = [];
    for (const f of files) {
      const p = photoProblem(f);
      if (p) notes.push(`${f.name}: ${p}`);
      else accepted.push(f);
    }
    if (accepted.length > room) {
      notes.push(`Only ${room} more photo${room === 1 ? "" : "s"} fit (up to ${max}). The rest were skipped.`);
      accepted.splice(room);
    }
    setProblems(notes);
    if (accepted.length === 0) return;

    setQueue(accepted.map((f) => f.name));
    for (const f of accepted) {
      try {
        onChange(await uploadListingImage(listingId, f));
      } catch (e) {
        setProblems((p) => [...p, `${f.name}: ${messageFrom(e, "images")}`]);
      } finally {
        setQueue((q) => q.slice(1));
      }
    }
  }

  async function run(imageId: string, fn: () => Promise<Listing>) {
    setBusyId(imageId);
    setProblems([]);
    try {
      onChange(await fn());
    } catch (e) {
      setProblems([messageFrom(e, "images")]);
    } finally {
      setBusyId(null);
    }
  }

  const shownError = error && problems.length === 0 ? error : undefined;

  return (
    <div>
      <ul className="grid grid-cols-3 gap-3 sm:grid-cols-4" aria-label="Photos">
        {images.map((img, i) => (
          <li
            key={img.id}
            className={cn(
              "group relative aspect-square overflow-hidden rounded-lg border bg-[var(--surface-2)]",
              i === 0 ? "border-[var(--text-primary)]" : "border-[var(--border-subtle)]"
            )}
          >
            <Image src={img.url} alt={img.fileName} fill unoptimized sizes="160px" className="object-cover" />
            {i === 0 && (
              <span className="absolute bottom-1.5 left-1.5 rounded-sm bg-[var(--text-primary)] px-1.5 py-0.5 text-[11px] font-semibold text-[var(--bg-card)]">
                Primary
              </span>
            )}
            <div className="absolute right-1.5 top-1.5 flex gap-1">
              {i > 0 && (
                <TileButton
                  label={`Make ${img.fileName} the primary photo`}
                  disabled={disabled || busyId !== null || uploading}
                  onClick={() => run(img.id, () => makePrimaryImage(listingId!, img.id))}
                >
                  <Star className="size-3.5" />
                </TileButton>
              )}
              <TileButton
                label={`Remove ${img.fileName}`}
                disabled={disabled || busyId !== null || uploading}
                onClick={() => run(img.id, () => removeListingImage(listingId!, img.id))}
              >
                {busyId === img.id ? <Spinner size={12} /> : <Trash2 className="size-3.5" />}
              </TileButton>
            </div>
          </li>
        ))}

        {queue.map((name, i) => (
          <li
            key={`${name}-${i}`}
            className="flex aspect-square flex-col items-center justify-center gap-2 rounded-lg border border-dashed border-[var(--border-color)] p-2 text-center"
          >
            <Spinner size={16} />
            <span className="line-clamp-2 break-all text-[11px] text-[var(--text-muted)]">{i === 0 ? "Uploading" : "Waiting"} · {name}</span>
          </li>
        ))}

        {room - queue.length > 0 && (
          <li>
            <label
              onDragOver={(e) => {
                if (!canAdd) return;
                e.preventDefault();
                setDragging(true);
              }}
              onDragLeave={() => setDragging(false)}
              onDrop={(e) => {
                e.preventDefault();
                setDragging(false);
                if (canAdd && e.dataTransfer.files.length) void addFiles(e.dataTransfer.files);
              }}
              className={cn(
                "flex aspect-square flex-col items-center justify-center gap-1.5 rounded-lg border border-dashed p-2 text-center transition-colors",
                canAdd
                  ? "cursor-pointer border-[var(--border-color)] text-[var(--text-secondary)] hover:border-[var(--text-primary)] hover:text-[var(--text-primary)] focus-within:border-[var(--text-primary)]"
                  : "cursor-not-allowed border-[var(--border-subtle)] text-[var(--text-muted)] opacity-70",
                dragging && "border-[var(--text-primary)] bg-[var(--surface-2)]"
              )}
            >
              <ImagePlus aria-hidden className="size-5" />
              <span className="text-12 font-semibold">{images.length === 0 ? "Add photos" : "Add more"}</span>
              <span className="text-[11px] leading-snug text-[var(--text-muted)]">
                {listingId ? `JPG, PNG or WEBP · 5 MB` : "After you save the draft"}
              </span>
              <input
                ref={inputRef}
                type="file"
                accept={IMAGE_ACCEPT}
                multiple
                className="sr-only"
                disabled={!canAdd}
                onChange={(e) => {
                  if (e.target.files?.length) void addFiles(e.target.files);
                  e.target.value = "";
                }}
              />
            </label>
          </li>
        )}
      </ul>

      <p className="mt-3 text-12 text-[var(--text-muted)]">
        {images.length} of {max}. Plain background, the part filling the frame, no watermarks or contact details. The first photo leads in
        search.
      </p>
      {(problems.length > 0 || shownError) && (
        <ul role="alert" className="mt-2 space-y-1 text-12 font-medium text-[var(--sig-danger-fg)]">
          {shownError && <li>{shownError}</li>}
          {problems.map((p, i) => (
            <li key={i}>{p}</li>
          ))}
        </ul>
      )}
    </div>
  );
}

function TileButton({ label, onClick, disabled, children }: { label: string; onClick: () => void; disabled?: boolean; children: React.ReactNode }) {
  return (
    <button
      type="button"
      aria-label={label}
      title={label}
      onClick={onClick}
      disabled={disabled}
      className="flex size-7 items-center justify-center rounded-md bg-[var(--bg-card)] text-[var(--text-primary)] shadow-sm ring-1 ring-black/10 transition hover:bg-[var(--surface-2)] disabled:opacity-40 focus-visible:outline-2 focus-visible:outline-offset-1 focus-visible:outline-[var(--focus-ring)]"
    >
      {children}
    </button>
  );
}
