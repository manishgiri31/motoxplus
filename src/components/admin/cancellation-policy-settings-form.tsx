"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { Percent, Save } from "lucide-react";
import { ConfirmDialog } from "@/components/ui/dialog";

interface Props {
  currentPreShip: number;
  currentPostShip: number;
  updatedAt: string | null;
  updatedByName: string | null;
}

export function CancellationPolicySettingsForm({ currentPreShip, currentPostShip, updatedAt, updatedByName }: Props) {
  const router = useRouter();
  const [preShip, setPreShip] = useState(currentPreShip.toString());
  const [postShip, setPostShip] = useState(currentPostShip.toString());
  const [confirmOpen, setConfirmOpen] = useState(false);
  const [status, setStatus] = useState<"idle" | "loading" | "success" | "error">("idle");
  const [errorMsg, setErrorMsg] = useState("");

  const preVal = parseFloat(preShip);
  const postVal = parseFloat(postShip);
  const valid = Number.isFinite(preVal) && preVal >= 0 && preVal <= 100 && Number.isFinite(postVal) && postVal >= 0 && postVal <= 100;

  const handleSave = async () => {
    if (!valid) {
      setErrorMsg("Both values must be between 0 and 100.");
      setStatus("error");
      return;
    }

    setStatus("loading");
    setErrorMsg("");
    setConfirmOpen(false);

    const res = await fetch("/api/admin/settings/cancellation-policy", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ preShipChargePercent: preVal, postShipChargePercent: postVal }),
    });

    if (!res.ok) {
      const data = await res.json().catch(() => ({}));
      setErrorMsg(data.error || "Failed to save settings");
      setStatus("error");
      return;
    }

    setStatus("success");
    router.refresh();
    setTimeout(() => setStatus("idle"), 3000);
  };

  return (
    <div className="glass-dark border border-[var(--border-color)] rounded-xl p-6 space-y-6">
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-2 text-[var(--text-secondary)] text-xs uppercase tracking-widest font-bold">
          <span className="w-1 h-4 bg-red-600 rounded-full inline-block" />
          Cancellation Policy
        </div>
        {updatedAt && (
          <p className="text-[var(--text-muted)] text-[10px]">
            Last changed {updatedAt}{updatedByName ? ` by ${updatedByName}` : ""}
          </p>
        )}
      </div>

      <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
        <div>
          <label className="text-[var(--text-muted)] text-xs uppercase tracking-wider block mb-2">
            Pre-Ship Charge (%)
          </label>
          <div className="relative">
            <Percent size={14} className="absolute right-4 top-1/2 -translate-y-1/2 text-[var(--text-muted)]" />
            <input
              type="number"
              step="0.1"
              min="0"
              max="100"
              value={preShip}
              onChange={(e) => { setPreShip(e.target.value); setStatus("idle"); }}
              className="w-full themed-input border focus:border-red-600/60 rounded-xl px-4 py-3 text-sm outline-none transition-colors pr-10"
            />
          </div>
          <p className="text-[var(--text-muted)] text-[10px] mt-1">Pending / Confirmed / Processing orders</p>
        </div>

        <div>
          <label className="text-[var(--text-muted)] text-xs uppercase tracking-wider block mb-2">
            Post-Ship Charge (%)
          </label>
          <div className="relative">
            <Percent size={14} className="absolute right-4 top-1/2 -translate-y-1/2 text-[var(--text-muted)]" />
            <input
              type="number"
              step="0.1"
              min="0"
              max="100"
              value={postShip}
              onChange={(e) => { setPostShip(e.target.value); setStatus("idle"); }}
              className="w-full themed-input border focus:border-red-600/60 rounded-xl px-4 py-3 text-sm outline-none transition-colors pr-10"
            />
          </div>
          <p className="text-[var(--text-muted)] text-[10px] mt-1">Shipped orders (not yet delivered)</p>
        </div>
      </div>

      {status === "error" && (
        <div className="bg-red-900/20 border border-red-900/40 rounded-xl px-4 py-3 text-red-400 text-sm">
          {errorMsg}
        </div>
      )}
      {status === "success" && (
        <div className="bg-green-900/20 border border-green-900/40 rounded-xl px-4 py-3 text-green-400 text-sm">
          Cancellation policy saved.
        </div>
      )}

      <button
        onClick={() => (valid ? setConfirmOpen(true) : handleSave())}
        disabled={status === "loading"}
        className="flex items-center gap-2 bg-red-600 hover:bg-red-700 disabled:opacity-50 text-white font-bold px-6 py-3 rounded-xl transition-colors text-sm uppercase tracking-wider"
      >
        <Save size={14} />
        {status === "loading" ? "Saving..." : "Save Policy"}
      </button>

      <ConfirmDialog
        open={confirmOpen}
        onOpenChange={setConfirmOpen}
        title="Update cancellation policy?"
        description={`This changes the charge for every future cancellation to ${preShip}% pre-ship / ${postShip}% post-ship, effective immediately. Orders already cancelled keep their original charge.`}
        confirmLabel="Save"
        confirmVariant="primary"
        onConfirm={handleSave}
      />
    </div>
  );
}
