"use client";

import { useMemo, useState } from "react";
import { useRouter } from "next/navigation";
import { Loader2, Pencil } from "lucide-react";
import { PartCategoryPicker } from "@/components/catalog/part-category-picker";
import { usePartCategoryTree } from "@/components/catalog/use-part-category-tree";
import { VehicleSegmentPicker } from "@/components/catalog/vehicle-segment-picker";
import { VendorSupplySummary } from "./vendor-supply-summary";

type Link = {
  category: { id: string; name: string; isActive: boolean; parent: { name: string } | null };
};

type Errors = { categoryIds?: string; vehicleSegments?: string; form?: string };

/**
 * Admin: what a vendor supplies, with an inline editor. The approved part categories decide which
 * categories the vendor can list products under, so this is how procurement adds or removes one.
 */
export function VendorSupplyEditor({
  vendorId,
  partCategories,
  vehicleSegments,
}: {
  vendorId: string;
  partCategories: Link[];
  vehicleSegments: string[];
}) {
  const router = useRouter();
  const [editing, setEditing] = useState(false);
  const [saving, setSaving] = useState(false);
  const [categoryIds, setCategoryIds] = useState<string[]>([]);
  const [segments, setSegments] = useState<string[]>([]);
  const [errors, setErrors] = useState<Errors>({});
  const { state } = usePartCategoryTree();

  const initialIds = useMemo(() => partCategories.map((l) => l.category.id), [partCategories]);
  const known = useMemo(
    () => (state.status === "ready" ? new Set(state.groups.flatMap((g) => [g.id, ...g.children.map((c) => c.id)])) : null),
    [state]
  );
  // Categories an admin has since deactivated can't be chosen again; they drop off on save.
  const droppedCount = known ? initialIds.filter((id) => !known.has(id)).length : 0;

  function startEditing() {
    setCategoryIds(initialIds);
    setSegments(vehicleSegments);
    setErrors({});
    setEditing(true);
  }

  async function save() {
    const ids = known ? categoryIds.filter((id) => known.has(id)) : categoryIds;
    const errs: Errors = {};
    if (ids.length === 0) errs.categoryIds = "Select at least one category this vendor manufactures or supplies";
    if (segments.length === 0) errs.vehicleSegments = "Select at least one vehicle segment";
    setErrors(errs);
    if (errs.categoryIds || errs.vehicleSegments) return;

    setSaving(true);
    try {
      const res = await fetch(`/api/vendors/${vendorId}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ categoryIds: ids, vehicleSegments: segments }),
      });
      const data = await res.json().catch(() => ({}));
      if (!res.ok) {
        const message = typeof data.error === "string" ? data.error : "Couldn't save. Try again.";
        setErrors(data.field === "categoryIds" || data.field === "vehicleSegments" ? { [data.field]: message } : { form: message });
        return;
      }
      setEditing(false);
      router.refresh();
    } catch {
      setErrors({ form: "Couldn't reach the server. Check your connection and try again." });
    } finally {
      setSaving(false);
    }
  }

  return (
    <div className="glass border border-[var(--border-color)] rounded-sm p-6">
      <div className="mb-5 flex items-start justify-between gap-4">
        <div>
          <h2 className="text-[var(--text-primary)] font-bold text-sm mb-1">What they supply</h2>
          <p className="text-[var(--text-muted)] text-xs">
            {editing
              ? "Changes apply immediately: the vendor can list new products under these categories only."
              : "Approving this vendor lets them list products under these categories only."}
          </p>
        </div>
        {!editing && (
          <button
            type="button"
            onClick={startEditing}
            className="inline-flex shrink-0 items-center gap-1.5 border border-[var(--border-color)] px-3 py-1.5 text-xs font-semibold text-[var(--text-primary)] rounded-sm hover:border-[var(--text-primary)] transition-colors"
          >
            <Pencil aria-hidden size={13} /> Edit
          </button>
        )}
      </div>

      {!editing ? (
        <VendorSupplySummary partCategories={partCategories} vehicleSegments={vehicleSegments} />
      ) : (
        <div className="space-y-6">
          <PartCategoryPicker
            value={categoryIds}
            onChange={(v) => {
              setCategoryIds(v);
              if (v.length) setErrors((e) => ({ ...e, categoryIds: undefined }));
            }}
            error={errors.categoryIds}
            hint={
              droppedCount > 0
                ? `${droppedCount} deactivated categor${droppedCount === 1 ? "y" : "ies"} on record will be removed when you save.`
                : undefined
            }
            required
            disabled={saving}
          />
          <VehicleSegmentPicker
            value={segments}
            onChange={(v) => {
              setSegments(v);
              if (v.length) setErrors((e) => ({ ...e, vehicleSegments: undefined }));
            }}
            error={errors.vehicleSegments}
            required
            disabled={saving}
          />
          {errors.form && (
            <p role="alert" className="text-sm text-[var(--sig-danger-fg)]">
              {errors.form}
            </p>
          )}
          <div className="flex items-center gap-3">
            <button
              type="button"
              onClick={save}
              disabled={saving}
              className="inline-flex items-center gap-2 bg-[var(--accent)] hover:bg-[var(--accent-hover)] disabled:opacity-50 px-5 py-2.5 text-sm text-white rounded-pill transition-colors"
            >
              {saving && <Loader2 aria-hidden size={14} className="animate-spin" />}
              {saving ? "Saving…" : "Save categories"}
            </button>
            <button
              type="button"
              onClick={() => setEditing(false)}
              disabled={saving}
              className="px-4 py-2.5 text-sm font-semibold text-[var(--text-muted)] hover:text-[var(--text-primary)] transition-colors"
            >
              Cancel
            </button>
          </div>
        </div>
      )}
    </div>
  );
}
