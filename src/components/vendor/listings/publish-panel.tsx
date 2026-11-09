"use client";

import { ArrowUpRight, Check } from "lucide-react";
import { Button } from "@/components/ui/button";
import { StatusBadge } from "@/components/ui/status-badge";
import { cn } from "@/lib/utils";
import type { FieldKey, ListingStatus } from "@/lib/vendor/listings";

export type Busy = null | "save" | "publish" | "unpublish";

export interface ChecklistItem {
  key: FieldKey;
  label: string;
  done: boolean;
}

/** The required items, in editor order, as the vendor reads them. */
export const CHECKLIST: { key: FieldKey; label: string }[] = [
  { key: "title", label: "Title" },
  { key: "categoryId", label: "Category" },
  { key: "brand", label: "Brand" },
  { key: "partNumber", label: "Part number" },
  { key: "sku", label: "Your SKU" },
  { key: "images", label: "At least one photo" },
  { key: "mrp", label: "MRP" },
  { key: "retailPrice", label: "Retail price" },
  { key: "dealerPrice", label: "Dealer price" },
  { key: "stock", label: "Stock" },
  { key: "hsnCode", label: "HSN code" },
];

function statusLine(status: ListingStatus | null, visible: boolean): string {
  if (status === "LIVE") return visible ? "Live. Buyers can find it in search." : "Live, but hidden while your account is not active.";
  if (status === "UNPUBLISHED") return "Unpublished. Hidden from buyers.";
  return "Draft. Not visible to buyers.";
}

/**
 * Status, what is still missing, and the one action that moves the listing forward. Sits beside the form on wide
 * screens and below it on phones (where ListingEditor also pins the primary action to the bottom of the screen).
 */
export function PublishPanel({
  status,
  storefront,
  checklist,
  dirty,
  busy,
  onSave,
  onPublish,
  onUnpublish,
  onJump,
}: {
  status: ListingStatus | null;
  storefront: { visible: boolean; url: string | null } | null;
  checklist: ChecklistItem[];
  dirty: boolean;
  busy: Busy;
  onSave: () => void;
  onPublish: () => void;
  onUnpublish: () => void;
  onJump: (key: FieldKey) => void;
}) {
  const remaining = checklist.filter((c) => !c.done).length;
  const live = status === "LIVE";
  const isNew = status === null;

  return (
    <div className="rounded-lg border border-[var(--border-subtle)] bg-[var(--bg-card)] p-5">
      <div className="flex items-center justify-between gap-3">
        <StatusBadge domain="listing" value={status ?? "DRAFT"} />
        {live && storefront?.visible && storefront.url && (
          <a
            href={storefront.url}
            target="_blank"
            rel="noopener noreferrer"
            className="inline-flex items-center gap-1 text-12 font-semibold text-[var(--accent-text)] hover:underline"
          >
            View on MotoXPlus <ArrowUpRight aria-hidden className="size-3.5" />
          </a>
        )}
      </div>
      <p className="mt-2.5 text-14 text-[var(--text-secondary)]">{statusLine(status, !!storefront?.visible)}</p>

      <div className="mt-5 border-t border-[var(--border-subtle)] pt-4">
        <h2 className="text-12 font-semibold uppercase tracking-[0.06em] text-[var(--text-muted)]">
          {remaining === 0 ? (live ? "Complete" : "Ready to publish") : `${remaining} to finish before it can go live`}
        </h2>
        <ol className="mt-3 space-y-0.5">
          {checklist.map((c) => (
            <li key={c.key}>
              <button
                type="button"
                onClick={() => onJump(c.key)}
                className={cn(
                  "flex w-full items-center gap-2.5 rounded-md px-1.5 py-1 text-left text-14 transition-colors hover:bg-[var(--surface-2)]",
                  c.done ? "text-[var(--text-muted)]" : "text-[var(--text-primary)]"
                )}
              >
                <span
                  aria-hidden
                  className={cn(
                    "flex size-4 shrink-0 items-center justify-center rounded-full border",
                    c.done ? "border-[var(--sig-ok-fg)] bg-[var(--sig-ok-fg)] text-white" : "border-[var(--border-color)]"
                  )}
                >
                  {c.done && <Check className="size-3" strokeWidth={3} />}
                </span>
                <span className={cn(c.done && "line-through decoration-[var(--border-color)]")}>{c.label}</span>
                <span className="sr-only">{c.done ? " (done)" : " (missing)"}</span>
              </button>
            </li>
          ))}
        </ol>
      </div>

      <div className="mt-5 space-y-2 border-t border-[var(--border-subtle)] pt-4">
        {isNew ? (
          <>
            <Button block onClick={onSave} loading={busy === "save"} disabled={busy !== null}>
              Save draft
            </Button>
            <p className="text-center text-12 text-[var(--text-muted)]">Photos come next, then publish.</p>
          </>
        ) : live ? (
          <>
            <Button block onClick={onSave} loading={busy === "save"} disabled={busy !== null || !dirty}>
              {dirty ? "Save changes" : "No unsaved changes"}
            </Button>
            <Button block variant="ghost" onClick={onUnpublish} loading={busy === "unpublish"} disabled={busy !== null}>
              Unpublish
            </Button>
            <p className="text-center text-12 text-[var(--text-muted)]">Changes go live as soon as you save.</p>
          </>
        ) : (
          <>
            <Button block onClick={onPublish} loading={busy === "publish"} disabled={busy !== null}>
              {status === "UNPUBLISHED" ? "Publish again" : "Publish"}
            </Button>
            <Button block variant="ghost" onClick={onSave} loading={busy === "save"} disabled={busy !== null || !dirty}>
              {dirty ? "Save draft" : "Draft saved"}
            </Button>
            <p className="text-center text-12 text-[var(--text-muted)]">No review queue: a complete listing goes live at once.</p>
          </>
        )}
      </div>
    </div>
  );
}
