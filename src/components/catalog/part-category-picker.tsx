"use client";

import * as React from "react";
import { Check, ChevronDown, Minus, RefreshCw, Search, X } from "lucide-react";
import { cn } from "@/lib/utils";
import {
  countSelectedSubcategories,
  filterGroups,
  groupState,
  removeFromSelection,
  selectionChips,
  toggleChild,
  toggleGroup,
  type PartCategoryGroup,
} from "@/lib/catalog/part-category-selection";
import { usePartCategoryTree } from "./use-part-category-tree";

/**
 * Automotive Parts Categories: searchable, grouped multi-select with removable chips.
 *
 * Keyboard: Enter/Space/ArrowDown on the field opens the list and moves into the search box;
 * ArrowDown/ArrowUp/Home/End move between options; Space toggles; Escape closes and returns focus.
 * Options are real checkboxes, so screen readers announce state without custom ARIA.
 */
export function PartCategoryPicker({
  id = "partCategories",
  label = "Automotive Parts Categories",
  placeholder = "Select the parts you manufacture or supply",
  value,
  onChange,
  error,
  hint,
  required,
  disabled,
}: {
  id?: string;
  label?: string;
  placeholder?: string;
  value: string[];
  onChange: (next: string[]) => void;
  error?: string;
  hint?: string;
  required?: boolean;
  disabled?: boolean;
}) {
  const { state, retry } = usePartCategoryTree();
  const groups = React.useMemo(() => (state.status === "ready" ? state.groups : []), [state]);
  const [open, setOpen] = React.useState(false);
  const [query, setQuery] = React.useState("");
  const triggerRef = React.useRef<HTMLButtonElement>(null);
  const searchRef = React.useRef<HTMLInputElement>(null);
  const listRef = React.useRef<HTMLDivElement>(null);

  const selected = React.useMemo(() => new Set(value), [value]);
  const visible = React.useMemo(() => filterGroups(groups, query), [groups, query]);
  const chips = React.useMemo(() => selectionChips(groups, value), [groups, value]);
  const subCount = countSelectedSubcategories(groups, value);

  const panelId = `${id}-panel`;
  const errId = error ? `${id}-error` : undefined;
  const hintId = hint ? `${id}-hint` : undefined;
  const describedBy = [hintId, errId].filter(Boolean).join(" ") || undefined;

  function openPanel() {
    if (disabled || state.status !== "ready") return;
    setOpen(true);
    requestAnimationFrame(() => searchRef.current?.focus());
  }

  function close(returnFocus = true) {
    setOpen(false);
    setQuery("");
    if (returnFocus) requestAnimationFrame(() => triggerRef.current?.focus());
  }

  function options(): HTMLInputElement[] {
    return Array.from(listRef.current?.querySelectorAll<HTMLInputElement>("input[data-option]") ?? []);
  }

  function onPanelKeyDown(e: React.KeyboardEvent) {
    if (e.key === "Escape") {
      e.preventDefault();
      e.stopPropagation();
      close();
      return;
    }
    if (!["ArrowDown", "ArrowUp", "Home", "End"].includes(e.key)) return;
    const opts = options();
    if (!opts.length) return;
    const fromSearch = e.target === searchRef.current;
    if (fromSearch && (e.key === "Home" || e.key === "End")) return; // keep caret movement in the search box
    e.preventDefault();
    const i = opts.indexOf(document.activeElement as HTMLInputElement);
    let next = 0;
    if (e.key === "End") next = opts.length - 1;
    else if (e.key === "Home") next = 0;
    else if (e.key === "ArrowDown") next = i < 0 ? 0 : Math.min(opts.length - 1, i + 1);
    else if (i <= 0) {
      searchRef.current?.focus();
      return;
    } else next = i - 1;
    opts[next].focus();
    opts[next].scrollIntoView({ block: "nearest" });
  }

  const summary =
    value.length === 0
      ? null
      : subCount > 0
        ? `${chips.length} selected · covers ${subCount} part type${subCount === 1 ? "" : "s"}`
        : `${chips.length} selected`;

  return (
    <div className="min-w-0" data-invalid={error ? "true" : undefined}>
      <p id={`${id}-label`} className="mb-1.5 text-xs font-semibold text-[var(--text-secondary)]">
        {label}
        {required && <span className="ml-0.5 text-[var(--sig-danger-fg)]">*</span>}
      </p>

      {state.status === "error" ? (
        <div role="alert" className="flex flex-wrap items-center gap-3 border border-[var(--sig-warn-bd)] bg-[var(--sig-warn-bg)] px-3 py-2.5 text-sm text-[var(--sig-warn-fg)]">
          We couldn&apos;t load the parts categories.
          <button type="button" onClick={retry} className="inline-flex items-center gap-1.5 font-semibold underline underline-offset-4">
            <RefreshCw aria-hidden className="size-3.5" /> Retry
          </button>
        </div>
      ) : (
        <button
          ref={triggerRef}
          id={id}
          type="button"
          aria-haspopup="true"
          aria-expanded={open}
          aria-controls={panelId}
          aria-labelledby={`${id}-label ${id}-value`}
          aria-describedby={describedBy}
          aria-invalid={!!error}
          disabled={disabled || state.status === "loading"}
          onClick={() => (open ? close(false) : openPanel())}
          onKeyDown={(e) => {
            if (e.key === "ArrowDown" && !open) {
              e.preventDefault();
              openPanel();
            }
          }}
          className={cn(
            "flex min-h-[48px] w-full items-center gap-3 border bg-white px-3 py-2.5 text-left text-sm transition-[border-color,box-shadow]",
            "focus-visible:outline-none focus-visible:shadow-[0_0_0_3px_var(--accent-ring)] focus-visible:border-mx-black",
            "disabled:cursor-not-allowed disabled:opacity-60",
            open ? "border-mx-black" : error ? "border-[var(--sig-danger-fg)]" : "border-[var(--input-border)] hover:border-mx-black"
          )}
        >
          <Search aria-hidden className="size-4 shrink-0 text-[var(--text-muted)]" />
          <span id={`${id}-value`} className={cn("min-w-0 flex-1 truncate", summary ? "font-medium text-mx-black" : "text-[var(--text-muted)]")}>
            {state.status === "loading" ? "Loading parts categories…" : summary ?? placeholder}
          </span>
          <ChevronDown aria-hidden className={cn("size-4 shrink-0 text-mx-black transition-transform", open && "rotate-180")} />
        </button>
      )}

      {open && (
        <div
          id={panelId}
          role="group"
          aria-label={`${label} options`}
          onKeyDown={onPanelKeyDown}
          className="border border-t-0 border-mx-black bg-white"
        >
          <div className="border-b border-black/10 p-2">
            <label htmlFor={`${id}-search`} className="sr-only">
              Search parts categories
            </label>
            <div className="flex items-center gap-2 border border-transparent bg-mx-off px-3 focus-within:border-mx-black focus-within:bg-white">
              <Search aria-hidden className="size-4 shrink-0 text-[var(--text-muted)]" />
              <input
                ref={searchRef}
                id={`${id}-search`}
                type="search"
                autoComplete="off"
                value={query}
                placeholder="Search parts categories…"
                onChange={(e) => setQuery(e.target.value)}
                onKeyDown={(e) => {
                  if (e.key === "Enter") e.preventDefault(); // never submit the surrounding form
                }}
                className="h-10 w-full bg-transparent text-sm text-mx-black outline-none focus:outline-none focus-visible:outline-none placeholder:text-[var(--text-muted)]"
              />
            </div>
          </div>

          <div ref={listRef} className="max-h-[min(60vh,440px)] overflow-y-auto overscroll-contain">
            {visible.length === 0 && (
              <p className="px-4 py-8 text-center text-sm text-[var(--text-muted)]">
                Nothing matches &ldquo;{query}&rdquo;. Try a broader word, or choose{" "}
                <span className="font-medium text-mx-black">Other Automotive Parts</span>.
              </p>
            )}
            {visible.map((g) => (
              <GroupBlock
                key={g.id}
                pickerId={id}
                group={g}
                fullGroup={groups.find((x) => x.id === g.id) ?? g}
                selected={selected}
                onToggleGroup={() => onChange(toggleGroup(groups, value, g.id))}
                onToggleChild={(childId) => onChange(toggleChild(groups, value, childId))}
              />
            ))}
          </div>

          <div className="flex items-center justify-between gap-3 border-t border-black/10 px-3 py-2">
            <span aria-live="polite" className="min-w-0 truncate text-xs text-[var(--text-muted)] tabular-nums">
              {value.length === 0 ? "Nothing selected" : `${chips.length} selected`}
              {subCount > 0 && <span className="hidden sm:inline"> · covers {subCount} part type{subCount === 1 ? "" : "s"}</span>}
            </span>
            <div className="flex shrink-0 items-center gap-1">
              {value.length > 0 && (
                <button
                  type="button"
                  onClick={() => onChange([])}
                  className="h-9 whitespace-nowrap px-3 text-sm font-medium text-[var(--text-secondary)] hover:text-mx-black focus-visible:outline-2 focus-visible:outline-mx-black"
                >
                  Clear all
                </button>
              )}
              <button
                type="button"
                onClick={() => close()}
                className="h-9 bg-mx-black px-4 text-sm font-semibold text-white hover:bg-mx-carbon focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-mx-black"
              >
                Done
              </button>
            </div>
          </div>
        </div>
      )}

      {chips.length > 0 && (
        <div className="mt-3">
          <div className="mb-2 flex items-center justify-between gap-3">
            <p className="text-xs font-semibold text-[var(--text-secondary)]">Selected categories</p>
            {!open && (
              <button
                type="button"
                onClick={() => onChange([])}
                disabled={disabled}
                className="text-xs font-medium text-[var(--text-muted)] underline-offset-4 hover:text-mx-black hover:underline focus-visible:outline-2 focus-visible:outline-mx-black"
              >
                Clear all
              </button>
            )}
          </div>
          <ul className="flex flex-wrap gap-1.5" aria-label="Selected categories">
            {chips.map((c) => (
              <li
                key={c.id}
                className={cn(
                  "inline-flex max-w-full items-center border text-[13px] leading-none",
                  c.isGroup ? "border-mx-black bg-mx-black text-white" : "border-black/15 bg-white text-mx-black"
                )}
              >
                <span className="truncate py-2 pl-2.5 pr-1" title={c.groupName ? `${c.groupName} › ${c.label}` : `${c.label} (all part types)`}>
                  {c.label}
                  {c.isGroup && <span className="ml-1.5 text-white/60">· all</span>}
                </span>
                <button
                  type="button"
                  disabled={disabled}
                  onClick={() => onChange(removeFromSelection(value, c.id))}
                  aria-label={`Remove ${c.label}`}
                  className={cn(
                    "grid size-8 shrink-0 place-items-center focus-visible:outline-2 focus-visible:outline-offset-[-2px]",
                    c.isGroup ? "text-white/70 hover:text-white focus-visible:outline-white" : "text-[var(--text-muted)] hover:text-mx-red focus-visible:outline-mx-black"
                  )}
                >
                  <X aria-hidden className="size-3.5" />
                </button>
              </li>
            ))}
          </ul>
        </div>
      )}

      {error ? (
        <p id={errId} className="mt-1.5 text-12 font-medium text-[var(--sig-danger-fg)]">{error}</p>
      ) : hint ? (
        <p id={hintId} className="mt-1.5 text-12 text-[var(--text-muted)]">{hint}</p>
      ) : null}
    </div>
  );
}

function GroupBlock({
  pickerId,
  group,
  fullGroup,
  selected,
  onToggleGroup,
  onToggleChild,
}: {
  pickerId: string;
  /** Possibly filtered by the search query. */
  group: PartCategoryGroup;
  /** Unfiltered, for the group's state and count. */
  fullGroup: PartCategoryGroup;
  selected: ReadonlySet<string>;
  onToggleGroup: () => void;
  onToggleChild: (id: string) => void;
}) {
  const st = groupState(fullGroup, selected);
  const headId = `${pickerId}-g-${group.id}`;
  const chosen = st === "all" ? fullGroup.children.length : fullGroup.children.filter((c) => selected.has(c.id)).length;

  return (
    <div role="group" aria-labelledby={headId} className="border-b border-black/10 last:border-b-0">
      <label
        className={cn(
          "sticky top-0 z-[1] flex cursor-pointer items-center gap-3 px-3 py-2.5 transition-colors",
          st === "all" ? "bg-[var(--accent-soft)]" : "bg-mx-off hover:bg-[#f0f0f2]"
        )}
      >
        <TriCheckbox state={st} onChange={onToggleGroup} data-option="" aria-describedby={`${headId}-meta`} />
        <span id={headId} className="min-w-0 flex-1 text-sm font-semibold text-mx-black">
          {group.name}
        </span>
        <span id={`${headId}-meta`} className="shrink-0 text-xs text-[var(--text-muted)] tabular-nums">
          {st === "all" ? "All selected" : chosen > 0 ? `${chosen} of ${fullGroup.children.length}` : `Select all ${fullGroup.children.length}`}
        </span>
      </label>
      <ul className="grid grid-cols-1 py-1 sm:grid-cols-2">
        {group.children.map((c) => {
          const checked = st === "all" || selected.has(c.id);
          return (
            <li key={c.id}>
              <label className="flex min-h-[40px] cursor-pointer items-center gap-3 py-1.5 pl-10 pr-3 text-sm text-[var(--text-primary)] hover:bg-mx-off">
                <TriCheckbox state={checked ? "all" : "none"} onChange={() => onToggleChild(c.id)} data-option="" />
                <span className={cn("min-w-0", checked && "font-medium text-mx-black")}>{c.name}</span>
              </label>
            </li>
          );
        })}
      </ul>
    </div>
  );
}

/** Native checkbox (keeps keyboard + screen-reader semantics) drawn as a square brand box with a mixed state. */
function TriCheckbox({
  state,
  onChange,
  ...rest
}: { state: "all" | "some" | "none"; onChange: () => void } & Omit<React.InputHTMLAttributes<HTMLInputElement>, "onChange">) {
  const ref = React.useRef<HTMLInputElement>(null);
  React.useEffect(() => {
    if (ref.current) ref.current.indeterminate = state === "some";
  }, [state]);
  return (
    <span className="relative grid size-[18px] shrink-0 place-items-center">
      <input
        ref={ref}
        type="checkbox"
        checked={state === "all"}
        aria-checked={state === "some" ? "mixed" : state === "all"}
        onChange={onChange}
        className="peer absolute inset-0 size-full cursor-pointer appearance-none border-[1.5px] border-[var(--input-border)] bg-white checked:border-mx-red checked:bg-mx-red indeterminate:border-mx-black indeterminate:bg-mx-black focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-mx-black"
        {...rest}
      />
      {state === "all" && <Check aria-hidden strokeWidth={3} className="pointer-events-none relative size-3 text-white" />}
      {state === "some" && <Minus aria-hidden strokeWidth={3} className="pointer-events-none relative size-3 text-white" />}
    </span>
  );
}
