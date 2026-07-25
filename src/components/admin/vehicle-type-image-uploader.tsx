"use client";

import { useEffect, useState } from "react";
import Image from "next/image";
import { Check, ImageOff, Loader2, Upload, X } from "lucide-react";
import { VEHICLE_CATEGORIES } from "@/lib/vehicle-categories";

/** Resize + JPEG-compress an image in the browser to avoid Vercel's 4.5 MB body limit. */
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
      canvas.width = w;
      canvas.height = h;
      canvas.getContext("2d")!.drawImage(img, 0, 0, w, h);
      canvas.toBlob(
        (blob) => (blob ? resolve(blob) : reject(new Error("Canvas compression failed"))),
        "image/jpeg",
        quality
      );
    };
    img.onerror = () => { URL.revokeObjectURL(objectUrl); reject(new Error("Image load failed")); };
    img.src = objectUrl;
  });
}

/** One image per vehicle category (Motorcycles, Scooters, Electric, Commercial) — powers the /vehicles landing page cards. */
export function VehicleTypeImageUploader() {
  const [heroImages, setHeroImages] = useState<Record<string, string>>({});
  const [loading, setLoading] = useState(true);
  const [uploading, setUploading] = useState<string | null>(null);
  const [saving, setSaving] = useState<string | null>(null);
  const [saved, setSaved] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    fetch("/api/admin/vehicle-types")
      .then((r) => r.json())
      .then((rows: { category: string; heroImage: string | null }[]) => {
        const map: Record<string, string> = {};
        for (const r of rows) map[r.category] = r.heroImage ?? "";
        setHeroImages(map);
      })
      .finally(() => setLoading(false));
  }, []);

  async function saveHeroImage(category: string, url: string) {
    setSaving(category);
    setError(null);
    try {
      const res = await fetch(`/api/admin/vehicle-types/${category}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ heroImage: url || null }),
      });
      if (!res.ok) throw new Error("Failed to save");
      setHeroImages((prev) => ({ ...prev, [category]: url }));
      setSaved(category);
      setTimeout(() => setSaved(null), 2000);
    } catch (err: any) {
      setError(`${category}: ${err.message}`);
    } finally {
      setSaving(null);
    }
  }

  async function handleFile(category: string, file: File) {
    if (!file.type.startsWith("image/")) return;
    setUploading(category);
    setError(null);
    try {
      const compressed = await compressImage(file, 1600, 0.85);
      const fd = new FormData();
      fd.append("file", compressed, file.name.replace(/\.[^.]+$/, ".jpg"));
      fd.append("category", category);
      const res = await fetch("/api/upload/vehicle-type-image", { method: "POST", body: fd });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error || "Upload failed");
      await saveHeroImage(category, data.url);
    } catch (err: any) {
      setError(`${category}: ${err.message}`);
    } finally {
      setUploading(null);
    }
  }

  if (loading) {
    return (
      <div className="flex items-center justify-center py-12 gap-2 text-[var(--text-muted)]">
        <Loader2 size={18} className="animate-spin" /> Loading vehicle types…
      </div>
    );
  }

  return (
    <div className="space-y-3">
      {error && (
        <div className="flex items-center gap-2 bg-red-900/20 border border-red-900/40 rounded-xl px-3 py-2 text-xs text-red-400">
          <span className="flex-1">{error}</span>
          <button onClick={() => setError(null)}><X size={12} /></button>
        </div>
      )}

      <div className="glass border border-[var(--border-color)] rounded-2xl divide-y divide-[var(--border-color)] overflow-hidden">
        {VEHICLE_CATEGORIES.map((cat) => {
          const url = heroImages[cat.value] ?? "";
          const isUploading = uploading === cat.value;
          const isSaving = saving === cat.value;
          const isSaved = saved === cat.value;

          return (
            <div key={cat.value} className="flex items-center gap-4 px-5 py-4">
              <label
                className="relative w-16 h-16 flex-shrink-0 rounded-xl overflow-hidden border border-[var(--border-color)] bg-[var(--bg-secondary)] hover:border-red-500/60 flex items-center justify-center cursor-pointer transition-colors"
                title="Click to upload"
              >
                <input
                  type="file"
                  accept="image/jpeg,image/jpg,image/png,image/webp"
                  className="hidden"
                  onChange={(e) => {
                    const file = e.target.files?.[0];
                    if (file) handleFile(cat.value, file);
                    e.target.value = "";
                  }}
                />
                {isUploading ? (
                  <Loader2 size={20} className="animate-spin text-red-500" />
                ) : url ? (
                  <>
                    <Image src={url} alt={cat.label} width={64} height={64} className="object-cover w-full h-full" unoptimized />
                    <div className="absolute inset-0 bg-black/50 opacity-0 hover:opacity-100 transition-opacity flex items-center justify-center">
                      <Upload size={16} className="text-white" />
                    </div>
                  </>
                ) : (
                  <ImageOff size={18} className="text-[var(--text-muted)] opacity-50" />
                )}
              </label>

              <div className="flex-1 min-w-0">
                <p className="text-[var(--text-primary)] text-sm font-bold">{cat.label}</p>
                <p className="text-[var(--text-muted)] text-xs mb-1.5">{cat.tagline}</p>
                <input
                  type="url"
                  placeholder="Or paste an image URL…"
                  value={url}
                  onChange={(e) => setHeroImages((prev) => ({ ...prev, [cat.value]: e.target.value }))}
                  onKeyDown={(e) => e.key === "Enter" && saveHeroImage(cat.value, url)}
                  className="w-full themed-input rounded-lg px-3 py-1.5 text-xs"
                />
              </div>

              {url && (
                <button
                  type="button"
                  title="Remove image"
                  onClick={() => saveHeroImage(cat.value, "")}
                  className="flex-shrink-0 w-7 h-7 rounded-lg flex items-center justify-center text-[var(--text-muted)] hover:text-red-400 hover:bg-red-500/10 transition-colors"
                >
                  <X size={13} />
                </button>
              )}

              <button
                type="button"
                onClick={() => saveHeroImage(cat.value, url)}
                disabled={isSaving || isUploading}
                className={`flex-shrink-0 w-9 h-9 rounded-xl flex items-center justify-center transition-all ${
                  isSaved ? "bg-green-600 text-white" : "bg-red-600 hover:bg-red-700 text-white disabled:opacity-50"
                }`}
                title="Save"
              >
                {isSaving ? <Loader2 size={14} className="animate-spin" /> : isSaved ? <Check size={14} /> : <span className="text-xs font-bold">→</span>}
              </button>
            </div>
          );
        })}
      </div>
    </div>
  );
}
