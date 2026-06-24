"use client";

import { useState, useEffect } from "react";
import Image from "next/image";
import { Check, Loader2, ImageOff, ChevronDown, ChevronUp } from "lucide-react";

interface ModelRow {
  vehicleModel: string;
  imageUrl: string | null;
  variantCount: number;
}

function getModelBadge(model: string) {
  if (/\bN\/M\b/.test(model)) return { label: "NEW", cls: "bg-green-500/20 text-green-500" };
  if (/\bO\/M\b/.test(model)) return { label: "OLD", cls: "bg-amber-500/20 text-amber-500" };
  return null;
}

export function ModelImageManager({ productId }: { productId: string }) {
  const [models, setModels] = useState<ModelRow[]>([]);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState<string | null>(null);
  const [saved, setSaved] = useState<string | null>(null);
  const [inputs, setInputs] = useState<Record<string, string>>({});
  const [collapsed, setCollapsed] = useState(true);

  useEffect(() => {
    fetch(`/api/admin/products/${productId}/model-images`)
      .then((r) => r.json())
      .then((data) => {
        setModels(data.models ?? []);
        const init: Record<string, string> = {};
        for (const m of data.models ?? []) init[m.vehicleModel] = m.imageUrl ?? "";
        setInputs(init);
        setLoading(false);
      });
  }, [productId]);

  const save = async (vehicleModel: string) => {
    setSaving(vehicleModel);
    const res = await fetch(`/api/admin/products/${productId}/model-images`, {
      method: "PUT",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ vehicleModel, imageUrl: inputs[vehicleModel] || null }),
    });
    if (res.ok) {
      setModels((prev) =>
        prev.map((m) => m.vehicleModel === vehicleModel ? { ...m, imageUrl: inputs[vehicleModel] || null } : m)
      );
      setSaved(vehicleModel);
      setTimeout(() => setSaved(null), 2000);
    }
    setSaving(null);
  };

  const filledCount = models.filter((m) => m.imageUrl).length;

  return (
    <div className="mt-10">
      <button
        type="button"
        onClick={() => setCollapsed((c) => !c)}
        className="w-full flex items-center justify-between glass border border-[var(--border-color)] rounded-2xl px-6 py-4 hover:border-red-600/40 transition-colors"
      >
        <div className="flex items-center gap-3">
          <span className="text-[var(--text-primary)] font-bold text-lg">Model Images</span>
          <span className="text-[var(--text-muted)] text-sm">
            {loading ? "Loading…" : `${filledCount} / ${models.length} set`}
          </span>
          {!loading && filledCount < models.length && (
            <span className="text-xs bg-amber-500/15 text-amber-500 px-2 py-0.5 rounded-full font-semibold">
              {models.length - filledCount} missing
            </span>
          )}
        </div>
        {collapsed ? <ChevronDown size={18} className="text-[var(--text-muted)]" /> : <ChevronUp size={18} className="text-[var(--text-muted)]" />}
      </button>

      {!collapsed && (
        <div className="mt-3 glass border border-[var(--border-color)] rounded-2xl overflow-hidden">
          {loading ? (
            <div className="flex items-center justify-center py-12 gap-2 text-[var(--text-muted)]">
              <Loader2 size={18} className="animate-spin" /> Loading models…
            </div>
          ) : (
            <>
              <p className="text-[var(--text-muted)] text-xs px-5 pt-4 pb-2">
                One image per vehicle model — applies to all color variants of that model.
              </p>
              <div className="divide-y divide-[var(--border-color)]">
                {models.map((m) => {
                  const badge = getModelBadge(m.vehicleModel);
                  const isSaving = saving === m.vehicleModel;
                  const isSaved = saved === m.vehicleModel;
                  const url = inputs[m.vehicleModel] ?? "";
                  return (
                    <div key={m.vehicleModel} className="flex items-center gap-4 px-5 py-3">
                      {/* Thumbnail */}
                      <div className="w-14 h-14 flex-shrink-0 rounded-xl overflow-hidden bg-[var(--bg-secondary)] border border-[var(--border-color)] flex items-center justify-center">
                        {m.imageUrl ? (
                          <Image src={m.imageUrl} alt={m.vehicleModel} width={56} height={56} className="object-cover w-full h-full" unoptimized />
                        ) : (
                          <ImageOff size={18} className="text-[var(--text-muted)] opacity-40" />
                        )}
                      </div>

                      {/* Model name + badge */}
                      <div className="flex-1 min-w-0">
                        <div className="flex items-center gap-2 mb-1">
                          <span className="text-[var(--text-primary)] text-sm font-semibold truncate">{m.vehicleModel}</span>
                          {badge && (
                            <span className={`text-[10px] font-bold px-1.5 py-0.5 rounded-full flex-shrink-0 ${badge.cls}`}>
                              {badge.label}
                            </span>
                          )}
                          <span className="text-[var(--text-muted)] text-[10px]">{m.variantCount} colors</span>
                        </div>
                        <input
                          type="url"
                          placeholder="Paste image URL…"
                          value={url}
                          onChange={(e) => setInputs((prev) => ({ ...prev, [m.vehicleModel]: e.target.value }))}
                          onKeyDown={(e) => e.key === "Enter" && save(m.vehicleModel)}
                          className="w-full themed-input rounded-lg px-3 py-1.5 text-xs"
                        />
                      </div>

                      {/* Save button */}
                      <button
                        type="button"
                        onClick={() => save(m.vehicleModel)}
                        disabled={isSaving}
                        className={`flex-shrink-0 w-9 h-9 rounded-xl flex items-center justify-center transition-all ${
                          isSaved
                            ? "bg-green-600 text-white"
                            : "bg-red-600 hover:bg-red-700 text-white"
                        }`}
                      >
                        {isSaving ? (
                          <Loader2 size={14} className="animate-spin" />
                        ) : isSaved ? (
                          <Check size={14} />
                        ) : (
                          <span className="text-xs font-bold">→</span>
                        )}
                      </button>
                    </div>
                  );
                })}
              </div>
            </>
          )}
        </div>
      )}
    </div>
  );
}
