/**
 * Automotive parts catalogue: the two-level Category tree suppliers pick from when they apply
 * (/become-vendor). Pure functions only — shared by the picker UI, the Node API and tests.
 *
 * Selection model: a list of category ids where a GROUP id means "everything in this group,
 * including subcategories added later", and a child id means just that subcategory. The
 * selection is always kept normalised:
 *   - a group id is never stored together with one of its own children;
 *   - when every subcategory of a group is selected, they collapse into the group id.
 */

export interface PartCategoryNode {
  id: string;
  name: string;
  slug: string;
}

export interface PartCategoryGroup extends PartCategoryNode {
  children: PartCategoryNode[];
}

export type GroupState = "all" | "some" | "none";

/** Selection limit; the whole tree normalises to 13 ids, so this only stops abuse. */
export const MAX_PART_CATEGORY_IDS = 200;

/** Dedupes, drops unknown ids, removes children covered by a selected group, collapses full groups. Tree order. */
export function normalizeSelection(groups: PartCategoryGroup[], ids: Iterable<string>): string[] {
  const wanted = new Set(ids);
  const out: string[] = [];
  for (const g of groups) {
    const allChildren = g.children.length > 0 && g.children.every((c) => wanted.has(c.id));
    if (wanted.has(g.id) || allChildren) {
      out.push(g.id);
      continue;
    }
    for (const c of g.children) if (wanted.has(c.id)) out.push(c.id);
  }
  return out;
}

export function groupState(group: PartCategoryGroup, selected: ReadonlySet<string>): GroupState {
  if (selected.has(group.id)) return "all";
  return group.children.some((c) => selected.has(c.id)) ? "some" : "none";
}

/** The group checkbox is "select all": fully selected -> clear the group, otherwise select all of it. */
export function toggleGroup(groups: PartCategoryGroup[], selected: string[], groupId: string): string[] {
  const group = groups.find((g) => g.id === groupId);
  if (!group) return selected;
  const childIds = new Set(group.children.map((c) => c.id));
  const rest = selected.filter((id) => id !== groupId && !childIds.has(id));
  return selected.includes(groupId) ? normalizeSelection(groups, rest) : normalizeSelection(groups, [...rest, groupId]);
}

/** Toggling one subcategory of a fully selected group keeps the group's other subcategories. */
export function toggleChild(groups: PartCategoryGroup[], selected: string[], childId: string): string[] {
  const group = groups.find((g) => g.children.some((c) => c.id === childId));
  if (!group) return selected;
  if (selected.includes(group.id)) {
    const others = group.children.filter((c) => c.id !== childId).map((c) => c.id);
    return normalizeSelection(groups, [...selected.filter((id) => id !== group.id), ...others]);
  }
  return selected.includes(childId)
    ? selected.filter((id) => id !== childId)
    : normalizeSelection(groups, [...selected, childId]);
}

/** Removes a chip: a group chip clears the whole group, a subcategory chip just that subcategory. */
export function removeFromSelection(selected: string[], id: string): string[] {
  return selected.filter((s) => s !== id);
}

export interface SelectionChip {
  id: string;
  label: string;
  /** Present for subcategory chips: the group the subcategory belongs to. */
  groupName?: string;
  isGroup: boolean;
}

export function selectionChips(groups: PartCategoryGroup[], selected: string[]): SelectionChip[] {
  const byId = new Map<string, SelectionChip>();
  for (const g of groups) {
    byId.set(g.id, { id: g.id, label: g.name, isGroup: true });
    for (const c of g.children) byId.set(c.id, { id: c.id, label: c.name, groupName: g.name, isGroup: false });
  }
  return selected.map((id) => byId.get(id)).filter((c): c is SelectionChip => !!c);
}

/**
 * Search: a group whose name matches shows all of its subcategories; otherwise only the matching
 * subcategories are shown. Matching is case-insensitive on every word of the query.
 */
export function filterGroups(groups: PartCategoryGroup[], query: string): PartCategoryGroup[] {
  const words = query.toLowerCase().split(/\s+/).filter(Boolean);
  if (words.length === 0) return groups;
  const matches = (s: string) => {
    const hay = s.toLowerCase();
    return words.every((w) => hay.includes(w));
  };
  const out: PartCategoryGroup[] = [];
  for (const g of groups) {
    if (matches(g.name)) {
      out.push(g);
      continue;
    }
    const children = g.children.filter((c) => matches(c.name) || matches(`${g.name} ${c.name}`));
    if (children.length) out.push({ ...g, children });
  }
  return out;
}

/** Every category id a selection covers: selected groups expand to all of their subcategories. */
export function expandSelection(groups: PartCategoryGroup[], selected: Iterable<string>): Set<string> {
  const wanted = new Set(selected);
  const out = new Set<string>();
  for (const g of groups) {
    if (wanted.has(g.id)) {
      out.add(g.id);
      for (const c of g.children) out.add(c.id);
    } else {
      for (const c of g.children) if (wanted.has(c.id)) out.add(c.id);
    }
  }
  return out;
}

export function countSelectedSubcategories(groups: PartCategoryGroup[], selected: string[]): number {
  const set = new Set(selected);
  return groups.reduce((n, g) => n + (set.has(g.id) ? g.children.length : g.children.filter((c) => set.has(c.id)).length), 0);
}
