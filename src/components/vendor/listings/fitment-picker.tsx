"use client";

import * as React from "react";
import { Search, X } from "lucide-react";
import { Input } from "@/components/ui/field";
import { Spinner } from "@/components/ui/spinner";
import { cn } from "@/lib/utils";
import { searchVehicles, type FitmentValue, type VehicleOption } from "@/lib/vendor/listings";

/**
 * Vehicles this part fits, picked from the MotoXPlus vehicle catalogue (never free text, so fitment stays queryable).
 * Each can carry an optional year range. What the vendor enters here is shown to buyers as seller-reported until
 * MotoXPlus verifies it.
 */
export function FitmentPicker({
  value,
  onChange,
  max,
  error,
  disabled,
}: {
  value: FitmentValue[];
  onChange: (next: FitmentValue[]) => void;
  max: number;
  error?: string;
  disabled?: boolean;
}) {
  const [q, setQ] = React.useState("");
  const [results, setResults] = React.useState<VehicleOption[]>([]);
  const [loading, setLoading] = React.useState(false);
  const [open, setOpen] = React.useState(false);
  const [active, setActive] = React.useState(0);
  const [lookupFailed, setLookupFailed] = React.useState(false);
  const listId = React.useId();
  const chosen = React.useMemo(() => new Set(value.map((v) => v.vehicleId)), [value]);
  const options = results.filter((r) => !chosen.has(r.id));
  const full = value.length >= max;

  React.useEffect(() => {
    const term = q.trim();
    if (term.length < 2) {
      setResults([]);
      setLoading(false);
      return;
    }
    const ctrl = new AbortController();
    setLoading(true);
    const t = setTimeout(async () => {
      try {
        setResults(await searchVehicles(term, ctrl.signal));
        setLookupFailed(false);
        setActive(0);
      } catch (e) {
        if (!(e instanceof DOMException && e.name === "AbortError")) setLookupFailed(true);
      } finally {
        if (!ctrl.signal.aborted) setLoading(false);
      }
    }, 250);
    return () => {
      clearTimeout(t);
      ctrl.abort();
    };
  }, [q]);

  function add(v: VehicleOption) {
    onChange([...value, { vehicleId: v.id, vehicleName: v.name, manufacturer: v.manufacturer, yearFrom: "", yearTo: "" }]);
    setQ("");
    setResults([]);
    setOpen(false);
  }

  function update(id: string, patch: Partial<FitmentValue>) {
    onChange(value.map((f) => (f.vehicleId === id ? { ...f, ...patch } : f)));
  }

  function onKeyDown(e: React.KeyboardEvent<HTMLInputElement>) {
    if (!open || options.length === 0) return;
    if (e.key === "ArrowDown") {
      e.preventDefault();
      setActive((a) => Math.min(a + 1, options.length - 1));
    } else if (e.key === "ArrowUp") {
      e.preventDefault();
      setActive((a) => Math.max(a - 1, 0));
    } else if (e.key === "Enter") {
      e.preventDefault();
      add(options[active]);
    } else if (e.key === "Escape") {
      setOpen(false);
    }
  }

  return (
    <div>
      <div className="relative max-w-md">
        <Search aria-hidden className="pointer-events-none absolute left-3 top-1/2 size-4 -translate-y-1/2 text-[var(--text-muted)]" />
        <Input
          id="fitment"
          role="combobox"
          aria-expanded={open && options.length > 0}
          aria-controls={listId}
          aria-autocomplete="list"
          aria-activedescendant={open && options[active] ? `${listId}-${options[active].id}` : undefined}
          aria-invalid={!!error}
          invalid={!!error}
          placeholder={full ? `Up to ${max} vehicles` : "Search a model, e.g. Splendor or Activa 6G"}
          value={q}
          disabled={disabled || full}
          onChange={(e) => {
            setQ(e.target.value);
            setOpen(true);
          }}
          onFocus={() => setOpen(true)}
          onBlur={() => setTimeout(() => setOpen(false), 120)}
          onKeyDown={onKeyDown}
          className="pl-9"
          autoComplete="off"
        />
        {loading && <Spinner size={14} className="absolute right-3 top-1/2 -translate-y-1/2" />}
        {open && q.trim().length >= 2 && !loading && (
          <ul
            id={listId}
            role="listbox"
            className="absolute z-20 mt-1 max-h-72 w-full overflow-auto rounded-lg border border-[var(--border-color)] bg-[var(--bg-card)] py-1 shadow-[var(--elev-3)]"
          >
            {options.length === 0 ? (
              <li className="px-3 py-2.5 text-12 text-[var(--text-muted)]">
                {lookupFailed ? "Vehicle search isn't available right now." : "No matching vehicles. Try the model name only."}
              </li>
            ) : (
              options.map((o, i) => (
                <li
                  key={o.id}
                  id={`${listId}-${o.id}`}
                  role="option"
                  aria-selected={i === active}
                  onMouseDown={(e) => e.preventDefault()}
                  onClick={() => add(o)}
                  onMouseEnter={() => setActive(i)}
                  className={cn(
                    "flex cursor-pointer items-baseline justify-between gap-3 px-3 py-2 text-14",
                    i === active ? "bg-[var(--surface-2)]" : ""
                  )}
                >
                  <span className="min-w-0 truncate">
                    <span className="text-[var(--text-muted)]">{o.manufacturer}</span>{" "}
                    <span className="font-medium text-[var(--text-primary)]">{o.name}</span>
                  </span>
                  {(o.yearFrom || o.yearTo) && (
                    <span className="tnum shrink-0 text-12 text-[var(--text-muted)]">
                      {o.yearFrom ?? "…"}–{o.yearTo ?? "now"}
                    </span>
                  )}
                </li>
              ))
            )}
          </ul>
        )}
      </div>

      {value.length > 0 && (
        <ul className="mt-4 divide-y divide-[var(--border-subtle)] rounded-lg border border-[var(--border-subtle)]">
          {value.map((f) => (
            <li key={f.vehicleId} className="flex flex-wrap items-center gap-x-4 gap-y-2 px-3 py-2.5 sm:flex-nowrap">
              <span className="min-w-0 flex-1 text-14">
                <span className="text-[var(--text-muted)]">{f.manufacturer}</span>{" "}
                <span className="font-medium text-[var(--text-primary)]">{f.vehicleName}</span>
              </span>
              <span className="flex items-center gap-1.5 text-12 text-[var(--text-muted)]">
                <YearInput label={`${f.vehicleName} from year`} placeholder="From" value={f.yearFrom} disabled={disabled}
                  onChange={(y) => update(f.vehicleId, { yearFrom: y })} />
                <span aria-hidden>–</span>
                <YearInput label={`${f.vehicleName} to year`} placeholder="To" value={f.yearTo} disabled={disabled}
                  onChange={(y) => update(f.vehicleId, { yearTo: y })} />
              </span>
              <button
                type="button"
                onClick={() => onChange(value.filter((x) => x.vehicleId !== f.vehicleId))}
                disabled={disabled}
                aria-label={`Remove ${f.manufacturer} ${f.vehicleName}`}
                className="rounded-md p-1.5 text-[var(--text-muted)] hover:bg-[var(--surface-2)] hover:text-[var(--text-primary)] disabled:opacity-40"
              >
                <X className="size-4" />
              </button>
            </li>
          ))}
        </ul>
      )}

      {error ? (
        <p className="mt-2 text-12 font-medium text-[var(--sig-danger-fg)]">{error}</p>
      ) : (
        <p className="mt-2 text-12 text-[var(--text-muted)]">
          Optional. Leave the years empty if it fits every year of a model. Buyers see this as reported by you until MotoXPlus
          verifies it.
        </p>
      )}
    </div>
  );
}

function YearInput({ label, placeholder, value, onChange, disabled }: {
  label: string;
  placeholder: string;
  value: string;
  onChange: (v: string) => void;
  disabled?: boolean;
}) {
  return (
    <input
      aria-label={label}
      placeholder={placeholder}
      inputMode="numeric"
      maxLength={4}
      value={value}
      disabled={disabled}
      onChange={(e) => onChange(e.target.value.replace(/\D/g, ""))}
      className="tnum h-8 w-[64px] rounded-sm border border-[var(--input-border)] bg-[var(--input-bg)] px-2 text-center text-14 text-[var(--text-primary)] outline-none focus:border-[var(--accent-hover)] focus:shadow-[0_0_0_3px_var(--accent-ring)] disabled:opacity-50"
    />
  );
}
