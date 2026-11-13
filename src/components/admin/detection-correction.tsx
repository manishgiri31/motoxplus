"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";

interface Props {
  logId: string;
  currentVehicleId: string | null;
  options: { id: string; label: string }[];
}

// Inline "this was actually a ..." control for one detection-log row.
export function DetectionCorrection({ logId, currentVehicleId, options }: Props) {
  const router = useRouter();
  const [value, setValue] = useState(currentVehicleId ?? "");
  const [state, setState] = useState<"idle" | "saving" | "saved" | "error">("idle");

  async function save(next: string) {
    setValue(next);
    setState("saving");
    try {
      const res = await fetch(`/api/admin/vehicles/detection-log/${logId}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        // A different vehicle invalidates the old variant match.
        body: JSON.stringify({ detectedVehicleId: next || null, detectedVariantId: null }),
      });
      if (!res.ok) throw new Error(String(res.status));
      setState("saved");
      router.refresh();
    } catch {
      setState("error");
      setValue(currentVehicleId ?? "");
    }
  }

  return (
    <div className="flex flex-col gap-1">
      <select
        aria-label="Correct vehicle"
        value={value}
        disabled={state === "saving"}
        onChange={(e) => save(e.target.value)}
        className="themed-input h-9 max-w-[220px] rounded-lg px-2 text-xs"
      >
        <option value="">No match</option>
        {options.map((o) => (
          <option key={o.id} value={o.id}>{o.label}</option>
        ))}
      </select>
      <span className="min-h-[16px] text-[11px]" aria-live="polite">
        {state === "saving" && <span className="text-[var(--text-muted)]">Saving…</span>}
        {state === "saved" && <span className="text-green-500">Saved</span>}
        {state === "error" && <span className="text-red-500">Couldn&apos;t save</span>}
      </span>
    </div>
  );
}
