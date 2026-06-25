"use client";

import { useState, useEffect, useRef } from "react";
import Image from "next/image";
import { Check, ChevronDown, ChevronUp, ImageOff, Loader2, Upload, X } from "lucide-react";

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

async function compressImage(file: File, maxDim: number, quality: number): Promise<Blob> {
  return new Promise((resolve, reject) => {
    const img = new window.Image();
    const objectUrl = URL.createObjectURL(file);
    img.onload = () => {
      URL.revokeObjectURL(objectUrl);
      let { naturalWidth: w, naturalHeight: h } = img;
      if (w > maxDim || h > maxDim) {
        if (w >= h) { h = Math.round((h * maxDim) / w); w = maxDim; }
        else { w = Math.round((w * maxDim) / h); h = maxDim; }
      }
      const canvas = document.createElement("canvas");
      canvas.width = w; canvas.height = h;
      canvas.getContext("2d")!.drawImage(img, 0, 0, w, h);
      canvas.toBlob(
        (blob) => (blob ? resolve(blob) : reject(new Error("Compression failed"))),
        "image/jpeg",
        quality
      );
    };
    img.onerror = () => { URL.revokeObjectURL(objectUrl); reject(new Error("Load failed")); };
    img.src = objectUrl;
  });
}

export function ModelImageManager({ productId }: { productId: string }) {
  const [models, setModels] = useState<ModelRow[]>([]);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState<string | null>(null);
  const [saved, setSaved] = useState<string | null>(null);
  const [uploading, setUploading] = useState<string | null>(null);
  const [uploadError, setUploadError] = useState<string | null>(null);
  const [inputs, setInputs] = useState<Record<string, string>>({});
  const [collapsed, setCollapsed] = useState(true);
  const [dragOver, setDragOver] = useState<string | null>(null);
  const fileRefs = useRef<Record<string, HTMLInputElement | null>>({});

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

  async function saveModelImage(vehicleModel: string, url: string) {
    setSaving(vehicleModel);
    const res = await fetch(`/api/admin/products/${productId}/model-images`, {
      method: "PUT",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ vehicleModel, imageUrl: url || null }),
    });
    if (res.ok) {
      setModels((prev) =>
        prev.map((m) => m.vehicleModel === vehicleModel ? { ...m, imageUrl: url || null } : m)
      );
      setInputs((prev) => ({ ...prev, [vehicleModel]: url }));
      setSaved(vehicleModel);
      setTimeout(() => setSaved(null), 2000);
    }
    setSaving(null);
  }

  async function handleFile(vehicleModel: string, file: File) {
    if (!file.type.startsWith("image/")) return;
    setUploading(vehicleModel);
    setUploadError(null);
    try {
      const compressed = await compressImage(file, 1200, 0.85);
      const fd = new FormData();
      fd.append("file", compressed, file.name.replace(/\.[^.]+$/, ".jpg"));
      fd.append("productId", productId);
      const res = await fetch("/api/upload/product-image", { method: "POST", body: fd });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error || "Upload failed");
      await saveModelImage(vehicleModel, data.url);
    } catch (err: any) {
      setUploadError(`${vehicleModel}: ${err.message}`);
    } finally {
      setUploading(null);
    }
  }

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
        {collapsed
          ? <ChevronDown size={18} className="text-[var(--text-muted)]" />
          : <ChevronUp size={18} className="text-[var(--text-muted)]" />}
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
                Upload or paste one image per vehicle model — it appears on the product page when that model is selected.
              </p>

              {uploadError && (
                <div className="mx-5 mb-3 flex items-center gap-2 bg-red-900/20 border border-red-900/40 rounded-xl px-3 py-2 text-xs text-red-400">
                  <span className="flex-1">{uploadError}</span>
                  <button onClick={() => setUploadError(null)}><X size={12} /></button>
                </div>
              )}

              <div className="divide-y divide-[var(--border-color)]">
                {models.map((m) => {
                  const badge = getModelBadge(m.vehicleModel);
                  const isSaving = saving === m.vehicleModel;
                  const isUploading = uploading === m.vehicleModel;
                  const isSaved = saved === m.vehicleModel;
                  const isDraggedOver = dragOver === m.vehicleModel;
                  const url = inputs[m.vehicleModel] ?? "";

                  return (
                    <div key={m.vehicleModel} className="flex items-center gap-3 px-5 py-3">
                      {/* Thumbnail — click or drag a file onto it to upload */}
                      <div
                        className={`relative w-14 h-14 flex-shrink-0 rounded-xl overflow-hidden border flex items-center justify-center cursor-pointer select-none transition-all ${
                          isDraggedOver
                            ? "border-red-500 bg-red-500/10 scale-105"
                            : "border-[var(--border-color)] bg-[var(--bg-secondary)] hover:border-red-500/60"
                        }`}
                        title="Click or drag an image here to upload"
                        onClick={() => fileRefs.current[m.vehicleModel]?.click()}
                        onDragOver={(e) => { e.preventDefault(); setDragOver(m.vehicleModel); }}
                        onDragLeave={() => setDragOver(null)}
                        onDrop={(e) => {
                          e.preventDefault();
                          setDragOver(null);
                          const file = e.dataTransfer.files[0];
                          if (file) handleFile(m.vehicleModel, file);
                        }}
                      >
                        <input
                          ref={(el) => { fileRefs.current[m.vehicleModel] = el; }}
                          type="file"
                          accept="image/*"
                          className="hidden"
                          onChange={(e) => {
                            const file = e.target.files?.[0];
                            if (file) handleFile(m.vehicleModel, file);
                            e.target.value = "";
                          }}
                        />

                        {isUploading ? (
                          <Loader2 size={20} className="animate-spin text-red-500" />
                        ) : m.imageUrl ? (
                          <>
                            <Image
                              src={m.imageUrl}
                              alt={m.vehicleModel}
                              width={56}
                              height={56}
                              className="object-cover w-full h-full"
                              unoptimized
                            />
                            {/* Hover overlay to signal re-upload */}
                            <div className="absolute inset-0 bg-black/50 opacity-0 hover:opacity-100 transition-opacity flex items-center justify-center">
                              <Upload size={16} className="text-white" />
                            </div>
                          </>
                        ) : (
                          <div className="flex flex-col items-center gap-0.5">
                            <ImageOff size={16} className="text-[var(--text-muted)] opacity-50" />
                            <span className="text-[8px] text-[var(--text-muted)] opacity-50 font-medium">Upload</span>
                          </div>
                        )}
                      </div>

                      {/* Model info + URL input */}
                      <div className="flex-1 min-w-0">
                        <div className="flex items-center gap-1.5 mb-1.5">
                          <span className="text-[var(--text-primary)] text-sm font-semibold truncate">
                            {m.vehicleModel}
                          </span>
                          {badge && (
                            <span className={`text-[10px] font-bold px-1.5 py-0.5 rounded-full flex-shrink-0 ${badge.cls}`}>
                              {badge.label}
                            </span>
                          )}
                          <span className="text-[var(--text-muted)] text-[10px] flex-shrink-0">
                            {m.variantCount} color{m.variantCount !== 1 ? "s" : ""}
                          </span>
                        </div>
                        <input
                          type="url"
                          placeholder="Or paste an image URL…"
                          value={url}
                          onChange={(e) =>
                            setInputs((prev) => ({ ...prev, [m.vehicleModel]: e.target.value }))
                          }
                          onKeyDown={(e) => e.key === "Enter" && saveModelImage(m.vehicleModel, url)}
                          className="w-full themed-input rounded-lg px-3 py-1.5 text-xs"
                        />
                      </div>

                      {/* Clear button */}
                      {(m.imageUrl || url) && (
                        <button
                          type="button"
                          title="Remove image"
                          onClick={() => saveModelImage(m.vehicleModel, "")}
                          className="flex-shrink-0 w-7 h-7 rounded-lg flex items-center justify-center text-[var(--text-muted)] hover:text-red-400 hover:bg-red-500/10 transition-colors"
                        >
                          <X size={13} />
                        </button>
                      )}

                      {/* Save URL button */}
                      <button
                        type="button"
                        onClick={() => saveModelImage(m.vehicleModel, url)}
                        disabled={isSaving || isUploading}
                        className={`flex-shrink-0 w-9 h-9 rounded-xl flex items-center justify-center transition-all ${
                          isSaved
                            ? "bg-green-600 text-white"
                            : "bg-red-600 hover:bg-red-700 text-white disabled:opacity-50"
                        }`}
                        title="Save URL"
                      >
                        {isSaving
                          ? <Loader2 size={14} className="animate-spin" />
                          : isSaved
                          ? <Check size={14} />
                          : <span className="text-xs font-bold">→</span>}
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
