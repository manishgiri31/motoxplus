"use client";

import * as React from "react";
import { useRouter } from "next/navigation";
import { ArrowDown, ArrowUp, ChevronRight, Pencil, Plus, Search } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input, Select, Switch } from "@/components/ui/field";
import { cn } from "@/lib/utils";

export interface AdminCategory {
  id: string;
  name: string;
  slug: string;
  description: string | null;
  isActive: boolean;
  sortOrder: number;
  parentId: string | null;
  _count: { products: number; vendors: number; children: number };
}

type Busy = string | null;

async function call(url: string, method: string, body: unknown): Promise<string | null> {
  try {
    const res = await fetch(url, { method, headers: { "Content-Type": "application/json" }, body: JSON.stringify(body) });
    if (res.ok) return null;
    const data = await res.json().catch(() => ({}));
    return data.error || `Request failed (${res.status})`;
  } catch {
    return "Network error. Try again.";
  }
}

/**
 * Admin -> Categories. One tree serves the shop (product categories) and the supplier application
 * (top-level categories with active subcategories). Server state is the source of truth: every
 * change calls the API and then refreshes the page data.
 */
export function CategoryManager({ categories }: { categories: AdminCategory[] }) {
  const router = useRouter();
  const [busy, setBusy] = React.useState<Busy>(null);
  const [error, setError] = React.useState<string | null>(null);
  const [query, setQuery] = React.useState("");
  const [expanded, setExpanded] = React.useState<Set<string>>(new Set());
  const [editing, setEditing] = React.useState<string | null>(null);

  const roots = categories.filter((c) => !c.parentId);
  const childrenOf = React.useMemo(() => {
    const m = new Map<string, AdminCategory[]>();
    for (const c of categories) if (c.parentId) m.set(c.parentId, [...(m.get(c.parentId) ?? []), c]);
    return m;
  }, [categories]);

  const q = query.trim().toLowerCase();
  const match = (c: AdminCategory) => !q || c.name.toLowerCase().includes(q) || c.slug.includes(q);

  async function run(key: string, url: string, method: string, body: unknown) {
    setBusy(key);
    setError(null);
    const err = await call(url, method, body);
    setBusy(null);
    if (err) {
      setError(err);
      return false;
    }
    router.refresh();
    return true;
  }

  function move(list: AdminCategory[], index: number, dir: -1 | 1) {
    const ids = list.map((c) => c.id);
    const j = index + dir;
    if (j < 0 || j >= ids.length) return;
    [ids[index], ids[j]] = [ids[j], ids[index]];
    void run(`move-${list[index].id}`, "/api/admin/categories/reorder", "POST", { parentId: list[index].parentId, orderedIds: ids });
  }

  function toggle(id: string) {
    setExpanded((s) => {
      const n = new Set(s);
      if (n.has(id)) n.delete(id);
      else n.add(id);
      return n;
    });
  }

  const supplierGroups = roots.filter((r) => r.isActive && (childrenOf.get(r.id) ?? []).some((c) => c.isActive)).length;

  return (
    <div className="space-y-5">
      <div className="grid gap-3 md:grid-cols-[1fr_auto]">
        <div className="relative">
          <Search aria-hidden className="pointer-events-none absolute left-3 top-1/2 size-4 -translate-y-1/2 text-[var(--text-muted)]" />
          <Input
            type="search"
            aria-label="Search categories"
            placeholder="Search categories…"
            value={query}
            onChange={(e) => setQuery(e.target.value)}
            className="pl-9"
          />
        </div>
        <AddForm
          label="Add top-level category"
          busy={busy === "add-root"}
          onAdd={(name) => run("add-root", "/api/admin/categories", "POST", { name, parentId: null })}
        />
      </div>

      <p className="text-xs text-[var(--text-muted)]">
        {roots.length} top-level · {categories.length - roots.length} subcategories ·{" "}
        <span className="text-[var(--text-secondary)]">{supplierGroups} groups shown on the supplier application</span> (a
        top-level category appears there once it has an active subcategory).
      </p>

      {error && (
        <div role="alert" className="rounded-sm border border-[var(--sig-danger-bd)] bg-[var(--sig-danger-bg)] px-4 py-2.5 text-sm text-[var(--sig-danger-fg)]">
          {error}
        </div>
      )}

      <ul className="divide-y divide-[var(--border-subtle)] rounded-sm border border-[var(--border-color)] bg-[var(--bg-card)]">
        {roots.map((root, i) => {
          const kids = childrenOf.get(root.id) ?? [];
          const visibleKids = q ? kids.filter(match) : kids;
          if (q && !match(root) && visibleKids.length === 0) return null;
          const open = !!q || expanded.has(root.id);
          return (
            <li key={root.id}>
              <Row
                c={root}
                depth={0}
                isFirst={i === 0}
                isLast={i === roots.length - 1}
                busy={busy}
                open={open}
                childCount={kids.length}
                inSupplierCatalogue={root.isActive && kids.some((k) => k.isActive)}
                onToggleOpen={() => toggle(root.id)}
                onMove={(d) => move(roots, i, d)}
                onActive={(v) => run(`active-${root.id}`, `/api/admin/categories/${root.id}`, "PATCH", { isActive: v })}
                editing={editing === root.id}
                onEdit={() => setEditing(editing === root.id ? null : root.id)}
                roots={roots}
                onSave={async (patch) => (await run(`save-${root.id}`, `/api/admin/categories/${root.id}`, "PATCH", patch)) && setEditing(null)}
              />
              {open && (
                <div className="border-t border-[var(--border-subtle)] bg-[var(--bg-primary)]/50">
                  <ul className="divide-y divide-[var(--border-subtle)]">
                    {visibleKids.map((k) => {
                      const idx = kids.indexOf(k);
                      return (
                        <li key={k.id}>
                          <Row
                            c={k}
                            depth={1}
                            isFirst={idx === 0}
                            isLast={idx === kids.length - 1}
                            busy={busy}
                            reorderDisabled={!!q}
                            onMove={(d) => move(kids, idx, d)}
                            onActive={(v) => run(`active-${k.id}`, `/api/admin/categories/${k.id}`, "PATCH", { isActive: v })}
                            editing={editing === k.id}
                            onEdit={() => setEditing(editing === k.id ? null : k.id)}
                            roots={roots}
                            onSave={async (patch) => (await run(`save-${k.id}`, `/api/admin/categories/${k.id}`, "PATCH", patch)) && setEditing(null)}
                          />
                        </li>
                      );
                    })}
                  </ul>
                  {!q && (
                    <div className="py-3 pl-12 pr-4">
                      <AddForm
                        compact
                        label={`Add subcategory to ${root.name}`}
                        busy={busy === `add-${root.id}`}
                        onAdd={(name) => run(`add-${root.id}`, "/api/admin/categories", "POST", { name, parentId: root.id })}
                      />
                    </div>
                  )}
                </div>
              )}
            </li>
          );
        })}
      </ul>
    </div>
  );
}

function Row({
  c,
  depth,
  isFirst,
  isLast,
  busy,
  open,
  childCount,
  inSupplierCatalogue,
  reorderDisabled,
  onToggleOpen,
  onMove,
  onActive,
  editing,
  onEdit,
  onSave,
  roots,
}: {
  c: AdminCategory;
  depth: 0 | 1;
  isFirst: boolean;
  isLast: boolean;
  busy: Busy;
  open?: boolean;
  childCount?: number;
  inSupplierCatalogue?: boolean;
  reorderDisabled?: boolean;
  onToggleOpen?: () => void;
  onMove: (dir: -1 | 1) => void;
  onActive: (v: boolean) => void;
  editing: boolean;
  onEdit: () => void;
  onSave: (patch: { name: string; description: string | null; parentId?: string | null }) => void;
  roots: AdminCategory[];
}) {
  const moving = busy === `move-${c.id}`;
  const meta = [
    depth === 0 && `${childCount ?? 0} sub`,
    `${c._count.products} product${c._count.products === 1 ? "" : "s"}`,
    c._count.vendors > 0 && `${c._count.vendors} vendor${c._count.vendors === 1 ? "" : "s"}`,
  ].filter(Boolean);

  return (
    <div className={cn(!c.isActive && "opacity-60")}>
      <div className={cn("flex flex-wrap items-center gap-x-3 gap-y-2 px-4 py-2.5", depth === 1 && "pl-12")}>
        {depth === 0 ? (
          <button
            type="button"
            onClick={onToggleOpen}
            aria-expanded={open}
            aria-label={`${open ? "Collapse" : "Expand"} ${c.name}`}
            className="grid size-7 place-items-center rounded-sm text-[var(--text-muted)] hover:bg-[var(--surface-3)] hover:text-[var(--text-primary)]"
          >
            <ChevronRight aria-hidden className={cn("size-4 transition-transform", open && "rotate-90")} />
          </button>
        ) : null}
        <div className="min-w-0 flex-1">
          <div className="flex flex-wrap items-baseline gap-x-2">
            <span className={cn("text-sm text-[var(--text-primary)]", depth === 0 && "font-semibold")}>{c.name}</span>
            <span className="font-mono text-[11px] text-[var(--text-muted)]">/{c.slug}</span>
            {inSupplierCatalogue && (
              <span className="rounded-sm border border-[var(--sig-ok-bd)] bg-[var(--sig-ok-bg)] px-1.5 py-px text-[10px] font-semibold uppercase tracking-wide text-[var(--sig-ok-fg)]">
                Supplier form
              </span>
            )}
            {!c.isActive && <span className="text-[11px] font-semibold uppercase tracking-wide text-[var(--sig-warn-fg)]">Inactive</span>}
          </div>
          <div className="text-xs text-[var(--text-muted)] tabular-nums">{meta.join(" · ")}</div>
        </div>
        <div className="flex items-center gap-1">
          <Button variant="secondary" size="icon" aria-label={`Move ${c.name} up`} disabled={isFirst || reorderDisabled || !!busy} onClick={() => onMove(-1)}>
            <ArrowUp aria-hidden />
          </Button>
          <Button variant="secondary" size="icon" aria-label={`Move ${c.name} down`} disabled={isLast || reorderDisabled || !!busy} loading={moving} onClick={() => onMove(1)}>
            <ArrowDown aria-hidden />
          </Button>
          <Button variant="secondary" size="icon" aria-label={`Edit ${c.name}`} aria-pressed={editing} onClick={onEdit}>
            <Pencil aria-hidden />
          </Button>
          <label className="ml-2 flex items-center gap-2 text-xs text-[var(--text-muted)]">
            <Switch checked={c.isActive} disabled={!!busy} onCheckedChange={onActive} />
            <span className="sr-only">{c.name} </span>Active
          </label>
        </div>
      </div>
      {editing && (
        <EditForm c={c} depth={depth} childCount={childCount ?? 0} roots={roots} busy={busy === `save-${c.id}`} onSave={onSave} onCancel={onEdit} />
      )}
    </div>
  );
}

function EditForm({
  c,
  depth,
  childCount,
  roots,
  busy,
  onSave,
  onCancel,
}: {
  c: AdminCategory;
  depth: 0 | 1;
  childCount: number;
  roots: AdminCategory[];
  busy: boolean;
  onSave: (patch: { name: string; description: string | null; parentId?: string | null }) => void;
  onCancel: () => void;
}) {
  const [name, setName] = React.useState(c.name);
  const [description, setDescription] = React.useState(c.description ?? "");
  const [parentId, setParentId] = React.useState(c.parentId ?? "");
  const canMove = depth === 1 || childCount === 0;

  return (
    <form
      className={cn("grid gap-3 border-t border-[var(--border-subtle)] bg-[var(--bg-primary)] px-4 py-4 md:grid-cols-[1fr_1.4fr_1fr_auto] md:items-end", depth === 1 && "md:pl-12")}
      onSubmit={(e) => {
        e.preventDefault();
        onSave({
          name: name.trim(),
          description: description.trim() || null,
          ...(canMove && (parentId || null) !== c.parentId && { parentId: parentId || null }),
        });
      }}
    >
      <label className="text-xs font-semibold text-[var(--text-secondary)]">
        Name
        <Input className="mt-1.5" value={name} onChange={(e) => setName(e.target.value)} required minLength={2} maxLength={80} />
      </label>
      <label className="text-xs font-semibold text-[var(--text-secondary)]">
        Description <span className="font-normal text-[var(--text-muted)]">(optional)</span>
        <Input className="mt-1.5" value={description} onChange={(e) => setDescription(e.target.value)} maxLength={500} />
      </label>
      <label className="text-xs font-semibold text-[var(--text-secondary)]">
        Group
        <Select className="mt-1.5" value={parentId} disabled={!canMove} onChange={(e) => setParentId(e.target.value)}>
          <option value="">None (top-level)</option>
          {roots.filter((r) => r.id !== c.id).map((r) => (
            <option key={r.id} value={r.id}>{r.name}</option>
          ))}
        </Select>
      </label>
      <div className="flex gap-2">
        <Button type="button" variant="secondary" size="sm" onClick={onCancel}>Cancel</Button>
        <Button type="submit" size="sm" loading={busy}>Save</Button>
      </div>
      <p className="text-xs text-[var(--text-muted)] md:col-span-4">
        The URL slug <span className="font-mono">/{c.slug}</span> stays the same so existing links keep working.
        {!canMove && " Categories with subcategories stay top-level."}
      </p>
    </form>
  );
}

function AddForm({ label, onAdd, busy, compact }: { label: string; onAdd: (name: string) => Promise<boolean>; busy: boolean; compact?: boolean }) {
  const [name, setName] = React.useState("");
  return (
    <form
      className="flex gap-2"
      onSubmit={async (e) => {
        e.preventDefault();
        if (name.trim().length < 2) return;
        if (await onAdd(name.trim())) setName("");
      }}
    >
      <Input
        aria-label={label}
        placeholder={compact ? "New subcategory name" : "New top-level category"}
        value={name}
        onChange={(e) => setName(e.target.value)}
        maxLength={80}
        className={cn(compact ? "md:w-72" : "md:w-64")}
      />
      <Button type="submit" variant={compact ? "secondary" : "primary"} size="sm" className="h-auto" loading={busy} disabled={name.trim().length < 2}>
        <Plus aria-hidden /> Add
      </Button>
    </form>
  );
}
