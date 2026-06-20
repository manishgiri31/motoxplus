"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { Percent, Save, Info } from "lucide-react";

interface Props {
  currentMarkup: number;
}

export function MarkupSettingsForm({ currentMarkup }: Props) {
  const router = useRouter();
  const [markup, setMarkup] = useState(currentMarkup.toString());
  const [status, setStatus] = useState<"idle" | "loading" | "success" | "error">("idle");
  const [errorMsg, setErrorMsg] = useState("");

  const handleSave = async () => {
    const val = parseFloat(markup);
    if (isNaN(val) || val < 0 || val > 500) {
      setErrorMsg("Markup must be between 0% and 500%");
      setStatus("error");
      return;
    }

    setStatus("loading");
    setErrorMsg("");

    const res = await fetch("/api/admin/settings", {
      method: "PUT",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ vendor_markup_percent: String(val) }),
    });

    if (!res.ok) {
      setErrorMsg("Failed to save settings");
      setStatus("error");
      return;
    }

    setStatus("success");
    router.refresh();
    setTimeout(() => setStatus("idle"), 3000);
  };

  const exampleCost = 1000;
  const previewPrice = exampleCost * (1 + (parseFloat(markup) || 0) / 100);

  return (
    <div className="glass-dark border border-[var(--border-color)] rounded-xl p-6 space-y-6">
      <div className="flex items-center gap-2 text-[var(--text-secondary)] text-xs uppercase tracking-widest font-bold">
        <span className="w-1 h-4 bg-red-600 rounded-full inline-block" />
        Vendor Product Markup
      </div>

      <div className="flex items-start gap-3 glass border border-blue-900/30 rounded-xl px-4 py-3">
        <Info size={14} className="text-blue-400 mt-0.5 flex-shrink-0" />
        <p className="text-[var(--text-muted)] text-xs leading-relaxed">
          This markup is automatically applied to vendor cost prices to calculate the final dealer price.
          Changing this affects all <span className="text-[var(--text-primary)] font-semibold">new</span> vendor product submissions. Existing products retain their markup unless manually updated.
        </p>
      </div>

      <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
        <div>
          <label className="text-[var(--text-muted)] text-xs uppercase tracking-wider block mb-2">
            Default Markup (%)
          </label>
          <div className="relative">
            <Percent size={14} className="absolute right-4 top-1/2 -translate-y-1/2 text-[var(--text-muted)]" />
            <input
              type="number"
              step="0.1"
              min="0"
              max="500"
              value={markup}
              onChange={(e) => { setMarkup(e.target.value); setStatus("idle"); }}
              className="w-full themed-input border focus:border-red-600/60 rounded-xl px-4 py-3 text-sm outline-none transition-colors pr-10"
              placeholder="20"
            />
          </div>
          <p className="text-[var(--text-muted)] text-[10px] mt-1">Applied to vendor cost price to get dealer price</p>
        </div>

        <div className="glass border border-[var(--border-color)] rounded-xl p-4">
          <div className="text-[var(--text-muted)] text-xs uppercase tracking-widest mb-3">Preview</div>
          <div className="space-y-2">
            <div className="flex items-center justify-between">
              <span className="text-[var(--text-muted)] text-sm">Vendor Cost</span>
              <span className="text-[var(--text-secondary)] font-semibold text-sm">₹{exampleCost.toLocaleString("en-IN")}</span>
            </div>
            <div className="flex items-center justify-between">
              <span className="text-[var(--text-muted)] text-sm">Markup ({parseFloat(markup) || 0}%)</span>
              <span className="text-amber-400 font-semibold text-sm">
                +₹{(exampleCost * (parseFloat(markup) || 0) / 100).toLocaleString("en-IN", { maximumFractionDigits: 2 })}
              </span>
            </div>
            <div className="flex items-center justify-between pt-2 border-t border-[var(--border-color)]">
              <span className="text-[var(--text-primary)] font-bold text-sm">Dealer Price</span>
              <span className="text-red-400 font-black text-lg">₹{previewPrice.toLocaleString("en-IN", { maximumFractionDigits: 2 })}</span>
            </div>
          </div>
        </div>
      </div>

      {status === "error" && (
        <div className="bg-red-900/20 border border-red-900/40 rounded-xl px-4 py-3 text-red-400 text-sm">
          {errorMsg}
        </div>
      )}

      {status === "success" && (
        <div className="bg-green-900/20 border border-green-900/40 rounded-xl px-4 py-3 text-green-400 text-sm">
          Settings saved successfully.
        </div>
      )}

      <button
        onClick={handleSave}
        disabled={status === "loading"}
        className="flex items-center gap-2 bg-red-600 hover:bg-red-700 disabled:opacity-50 text-white font-bold px-6 py-3 rounded-xl transition-colors text-sm uppercase tracking-wider"
      >
        <Save size={14} />
        {status === "loading" ? "Saving..." : "Save Settings"}
      </button>
    </div>
  );
}
