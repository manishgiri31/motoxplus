import { vehicleSegmentLabel } from "@/lib/catalog/vehicle-segments";

/** Prisma include for the data VendorSupplySummary renders. */
export const vendorSupplyInclude = {
  partCategories: {
    include: { category: { select: { id: true, name: true, isActive: true, parent: { select: { name: true } } } } },
  },
} as const;

type Link = {
  category: { id: string; name: string; isActive: boolean; parent: { name: string } | null };
};

/**
 * What a vendor manufactures or supplies: part categories grouped by top-level group, plus vehicle
 * segments. A top-level entry means "the whole group" (including subcategories added later).
 */
export function VendorSupplySummary({
  partCategories,
  vehicleSegments,
  emptyText = "No automotive part categories on record (applied before categories were introduced).",
}: {
  partCategories: Link[];
  vehicleSegments: string[];
  emptyText?: string;
}) {
  const groups = new Map<string, { whole: boolean; inactive: boolean; items: { name: string; inactive: boolean }[] }>();
  for (const { category: c } of partCategories) {
    const key = c.parent?.name ?? c.name;
    const g = groups.get(key) ?? { whole: false, inactive: false, items: [] };
    if (c.parent) g.items.push({ name: c.name, inactive: !c.isActive });
    else {
      g.whole = true;
      g.inactive = !c.isActive;
    }
    groups.set(key, g);
  }

  return (
    <div className="space-y-4">
      <div>
        <div className="mb-2 text-xs text-[var(--text-muted)]">Automotive parts categories</div>
        {groups.size === 0 ? (
          <p className="text-sm text-[var(--text-muted)]">{emptyText}</p>
        ) : (
          <dl className="divide-y divide-[var(--border-subtle)] border-y border-[var(--border-subtle)]">
            {[...groups.entries()].map(([name, g]) => (
              <div key={name} className="grid grid-cols-1 gap-1 py-2.5 sm:grid-cols-[minmax(0,14rem)_1fr] sm:gap-4">
                <dt className="text-sm font-semibold text-[var(--text-primary)]">
                  {name}
                  {g.inactive && <span className="ml-2 text-xs font-normal text-[var(--sig-warn-fg)]">(deactivated)</span>}
                </dt>
                <dd className="text-sm text-[var(--text-secondary)]">
                  {g.whole ? (
                    <span className="font-medium text-[var(--text-primary)]">All part types</span>
                  ) : (
                    g.items.map((i, n) => (
                      <span key={i.name}>
                        {n > 0 && ", "}
                        {i.name}
                        {i.inactive && <span className="text-[var(--sig-warn-fg)]"> (deactivated)</span>}
                      </span>
                    ))
                  )}
                </dd>
              </div>
            ))}
          </dl>
        )}
      </div>
      {vehicleSegments.length > 0 && (
        <div>
          <div className="mb-2 text-xs text-[var(--text-muted)]">Vehicle segments</div>
          <ul className="flex flex-wrap gap-1.5">
            {vehicleSegments.map((s) => (
              <li key={s} className="border border-[var(--border-color)] px-2.5 py-1 text-xs text-[var(--text-secondary)]">
                {vehicleSegmentLabel(s)}
              </li>
            ))}
          </ul>
        </div>
      )}
    </div>
  );
}
