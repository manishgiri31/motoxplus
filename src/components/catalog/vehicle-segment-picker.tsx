"use client";

import { Bike, Car, Truck, CircleEllipsis, type LucideIcon } from "lucide-react";
import { cn } from "@/lib/utils";
import { VEHICLE_SEGMENTS, type VehicleSegmentValue } from "@/lib/catalog/vehicle-segments";

const ICONS: Record<VehicleSegmentValue, LucideIcon> = {
  MOTORCYCLE: Bike,
  SCOOTER: Bike,
  THREE_WHEELER: Truck,
  PASSENGER_CAR: Car,
  COMMERCIAL_VEHICLE: Truck,
  OTHER: CircleEllipsis,
};

/** "Which vehicle segments do you supply parts for?" — a fieldset of real checkboxes in a hairline grid. */
export function VehicleSegmentPicker({
  name = "vehicleSegments",
  legend = "Which vehicle segments do you supply parts for?",
  value,
  onChange,
  error,
  hint,
  required,
  disabled,
}: {
  name?: string;
  legend?: string;
  value: string[];
  onChange: (next: string[]) => void;
  error?: string;
  hint?: string;
  required?: boolean;
  disabled?: boolean;
}) {
  const errId = error ? `${name}-error` : undefined;
  const hintId = hint ? `${name}-hint` : undefined;
  return (
    <fieldset aria-describedby={[hintId, errId].filter(Boolean).join(" ") || undefined} className="min-w-0" data-invalid={error ? "true" : undefined}>
      <legend className="mb-1.5 text-xs font-semibold text-[var(--text-secondary)]">
        {legend}
        {required && <span className="ml-0.5 text-[var(--sig-danger-fg)]">*</span>}
      </legend>
      <div
        className={cn(
          "grid grid-cols-2 gap-px border sm:grid-cols-3",
          error ? "border-[var(--sig-danger-fg)] bg-[var(--sig-danger-fg)]" : "border-[var(--input-border)] bg-[var(--input-border)]"
        )}
      >
        {VEHICLE_SEGMENTS.map((s) => {
          const checked = value.includes(s.value);
          const Icon = ICONS[s.value];
          const id = `${name}-${s.value.toLowerCase()}`;
          return (
            <label
              key={s.value}
              htmlFor={id}
              className={cn(
                "relative flex min-h-[52px] cursor-pointer items-center gap-2.5 px-3 py-2.5 text-sm transition-colors",
                "has-[:focus-visible]:outline has-[:focus-visible]:outline-2 has-[:focus-visible]:outline-offset-[-2px] has-[:focus-visible]:outline-mx-black",
                checked ? "bg-[var(--accent-soft)] font-medium text-mx-black" : "bg-white text-[var(--text-primary)] hover:bg-mx-off",
                disabled && "cursor-not-allowed opacity-60"
              )}
            >
              <input
                id={id}
                type="checkbox"
                className="size-4 shrink-0 cursor-pointer accent-mx-red focus-visible:outline-none"
                checked={checked}
                disabled={disabled}
                onChange={() => onChange(checked ? value.filter((v) => v !== s.value) : [...value, s.value])}
              />
              <Icon aria-hidden className={cn("size-4 shrink-0", checked ? "text-mx-red" : "text-[var(--text-muted)]")} />
              <span className="min-w-0">{s.label}</span>
            </label>
          );
        })}
      </div>
      {error ? (
        <p id={errId} className="mt-1.5 text-12 font-medium text-[var(--sig-danger-fg)]">{error}</p>
      ) : hint ? (
        <p id={hintId} className="mt-1.5 text-12 text-[var(--text-muted)]">{hint}</p>
      ) : null}
    </fieldset>
  );
}
