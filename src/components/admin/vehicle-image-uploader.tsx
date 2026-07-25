"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import Image from "next/image";
import { GripVertical, ImageOff, ImagePlus, Loader2, Trash2, Upload, X } from "lucide-react";

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

async function uploadVehicleImage(file: File, vehicleId?: string) {
  const compressed = await compressImage(file, 1920, 0.85);
  const fd = new FormData();
  fd.append("file", compressed, file.name.replace(/\.[^.]+$/, ".jpg"));
  if (vehicleId) fd.append("vehicleId", vehicleId);

  const res = await fetch("/api/upload/vehicle-image", { method: "POST", body: fd });
  const text = await res.text();
  let data: any;
  try {
    data = JSON.parse(text);
  } catch {
    throw new Error(res.status === 413 ? "Image is too large — please use a smaller file." : `Server error (${res.status})`);
  }
  if (!res.ok) throw new Error(data.error || "Upload failed");
  return data as { url: string; mediumUrl: string; thumbnailUrl: string; key: string };
}

/** Single-image control for a vehicle's hero image — click/drag to upload, or paste a URL directly. */
export function VehicleHeroImageUploader({
  value,
  onChange,
  vehicleId,
}: {
  value: string;
  onChange: (url: string) => void;
  vehicleId?: string;
}) {
  const [uploading, setUploading] = useState(false);
  const [error, setError] = useState("");
  const [dragOver, setDragOver] = useState(false);
  const fileRef = useRef<HTMLInputElement>(null);

  const handleFile = useCallback(
    async (file: File) => {
      if (!file.type.startsWith("image/")) return;
      setUploading(true);
      setError("");
      try {
        const data = await uploadVehicleImage(file, vehicleId);
        onChange(data.url);
      } catch (err: any) {
        setError(err.message || "Upload failed");
      } finally {
        setUploading(false);
      }
    },
    [vehicleId, onChange]
  );

  return (
    <div className="space-y-2">
      <div className="flex items-center gap-3">
        <div
          className={`relative w-20 h-20 flex-shrink-0 rounded-xl overflow-hidden border flex items-center justify-center cursor-pointer select-none transition-all ${
            dragOver
              ? "border-red-500 bg-red-500/10 scale-105"
              : "border-[var(--border-color)] bg-[var(--bg-secondary)] hover:border-red-500/60"
          }`}
          title="Click or drag an image here to upload"
          onClick={() => fileRef.current?.click()}
          onDragOver={(e) => { e.preventDefault(); setDragOver(true); }}
          onDragLeave={() => setDragOver(false)}
          onDrop={(e) => {
            e.preventDefault();
            setDragOver(false);
            const file = e.dataTransfer.files[0];
            if (file) handleFile(file);
          }}
        >
          <input
            ref={fileRef}
            type="file"
            accept="image/jpeg,image/jpg,image/png,image/webp"
            className="hidden"
            onChange={(e) => {
              const file = e.target.files?.[0];
              if (file) handleFile(file);
              e.target.value = "";
            }}
          />
          {uploading ? (
            <Loader2 size={20} className="animate-spin text-red-500" />
          ) : value ? (
            <>
              <Image src={value} alt="Hero" width={80} height={80} className="object-cover w-full h-full" unoptimized />
              <div className="absolute inset-0 bg-black/50 opacity-0 hover:opacity-100 transition-opacity flex items-center justify-center">
                <Upload size={18} className="text-white" />
              </div>
            </>
          ) : (
            <div className="flex flex-col items-center gap-1">
              <ImageOff size={18} className="text-[var(--text-muted)] opacity-50" />
              <span className="text-[9px] text-[var(--text-muted)] opacity-50 font-medium">Upload</span>
            </div>
          )}
        </div>

        <div className="flex-1 min-w-0 space-y-1.5">
          <input
            type="url"
            placeholder="Or paste an image URL…"
            value={value}
            onChange={(e) => onChange(e.target.value)}
            className="w-full bg-[var(--bg-input)] border border-[var(--border-color)] rounded-xl px-3 py-2 text-sm text-[var(--text-primary)] focus:outline-none focus:border-red-600"
          />
          {value && (
            <button
              type="button"
              onClick={() => onChange("")}
              className="text-[var(--text-muted)] hover:text-red-400 text-xs flex items-center gap-1"
            >
              <X size={11} /> Clear
            </button>
          )}
        </div>
      </div>
      {error && <p className="text-red-400 text-xs">{error}</p>}
    </div>
  );
}

interface GalleryImage {
  id: string;
  imageUrl: string;
  sortOrder: number;
}

/** Multi-image grid manager for a vehicle's gallery — talks directly to /api/admin/vehicles/:id/gallery. */
export function VehicleGalleryManager({ vehicleId }: { vehicleId: string }) {
  const [images, setImages] = useState<GalleryImage[]>([]);
  const [loading, setLoading] = useState(true);
  const [uploadingCount, setUploadingCount] = useState(0);
  const [error, setError] = useState("");
  const [isDragOver, setIsDragOver] = useState(false);
  const fileInputRef = useRef<HTMLInputElement>(null);
  const dragCard = useRef<number | null>(null);
  const dragOverCard = useRef<number | null>(null);

  const base = `/api/admin/vehicles/${vehicleId}/gallery`;

  useEffect(() => {
    setLoading(true);
    fetch(base)
      .then((r) => r.json())
      .then((data) => setImages(data ?? []))
      .finally(() => setLoading(false));
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [vehicleId]);

  const uploadOne = useCallback(
    async (file: File, sortOrder: number) => {
      setUploadingCount((n) => n + 1);
      setError("");
      try {
        const data = await uploadVehicleImage(file, vehicleId);
        const res = await fetch(base, {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ imageUrl: data.url, sortOrder: String(sortOrder) }),
        });
        if (!res.ok) throw new Error("Failed to save gallery image");
        const row = await res.json();
        setImages((prev) => [...prev, row]);
      } catch (err: any) {
        setError(err.message || "Upload failed");
      } finally {
        setUploadingCount((n) => n - 1);
      }
    },
    [vehicleId, base]
  );

  const handleFiles = useCallback(
    (files: FileList | null) => {
      if (!files) return;
      Array.from(files).forEach((file, i) => uploadOne(file, images.length + i));
    },
    [images.length, uploadOne]
  );

  const removeImage = async (id: string) => {
    setImages((prev) => prev.filter((img) => img.id !== id));
    await fetch(`${base}/${id}`, { method: "DELETE" });
  };

  const onCardDragStart = (idx: number) => { dragCard.current = idx; };
  const onCardDragEnter = (idx: number) => { dragOverCard.current = idx; };
  const onCardDragEnd = () => {
    if (dragCard.current === null || dragOverCard.current === null) return;
    if (dragCard.current === dragOverCard.current) return;
    setImages((prev) => {
      const next = [...prev];
      const [moved] = next.splice(dragCard.current!, 1);
      next.splice(dragOverCard.current!, 0, moved);
      const reordered = next.map((img, i) => ({ ...img, sortOrder: i }));
      reordered.forEach((img) => {
        fetch(`${base}/${img.id}`, {
          method: "PATCH",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ sortOrder: String(img.sortOrder) }),
        });
      });
      return reordered;
    });
    dragCard.current = null;
    dragOverCard.current = null;
  };

  if (loading) {
    return <p className="text-[var(--text-muted)] text-xs">Loading gallery…</p>;
  }

  return (
    <div className="space-y-3">
      <div
        onDragOver={(e) => { e.preventDefault(); if (e.dataTransfer.types.includes("Files")) setIsDragOver(true); }}
        onDragLeave={() => setIsDragOver(false)}
        onDrop={(e) => {
          e.preventDefault();
          setIsDragOver(false);
          if (e.dataTransfer.types.includes("Files")) handleFiles(e.dataTransfer.files);
        }}
        onClick={() => fileInputRef.current?.click()}
        className={`border-2 border-dashed rounded-xl p-6 text-center cursor-pointer transition-colors ${
          isDragOver
            ? "border-red-500 bg-red-500/10"
            : "border-[var(--border-color)] hover:border-red-600/60 hover:bg-[var(--bg-card-hover)]"
        }`}
      >
        <input
          ref={fileInputRef}
          type="file"
          multiple
          accept="image/jpeg,image/jpg,image/png,image/webp"
          className="hidden"
          onChange={(e) => handleFiles(e.target.files)}
        />
        <Upload className="w-6 h-6 text-[var(--text-muted)] mx-auto mb-2" />
        <p className="text-[var(--text-secondary)] text-sm font-medium">
          Drop images here or <span className="text-red-500">click to upload</span>
        </p>
      </div>

      {error && <p className="text-red-400 text-xs">{error}</p>}

      {(images.length > 0 || uploadingCount > 0) && (
        <div className="grid grid-cols-2 sm:grid-cols-4 md:grid-cols-6 gap-3">
          {images.map((img, idx) => (
            <div
              key={img.id}
              draggable
              onDragStart={() => onCardDragStart(idx)}
              onDragEnter={() => onCardDragEnter(idx)}
              onDragEnd={onCardDragEnd}
              onDragOver={(e) => e.preventDefault()}
              className="relative group rounded-lg overflow-hidden border border-[var(--border-color)] aspect-square cursor-grab active:cursor-grabbing"
            >
              <Image src={img.imageUrl} alt="Gallery" fill className="object-cover" sizes="200px" unoptimized />
              <div className="absolute top-1 right-1 opacity-0 group-hover:opacity-100 transition-opacity">
                <GripVertical className="w-4 h-4 text-white drop-shadow" />
              </div>
              <div className="absolute bottom-0 left-0 right-0 bg-gradient-to-t from-black/80 to-transparent p-1.5 opacity-0 group-hover:opacity-100 transition-opacity flex justify-end">
                <button type="button" title="Remove" onClick={() => removeImage(img.id)} className="text-red-400 hover:text-red-300">
                  <Trash2 className="w-3.5 h-3.5" />
                </button>
              </div>
            </div>
          ))}

          {Array.from({ length: uploadingCount }).map((_, i) => (
            <div key={`uploading-${i}`} className="aspect-square rounded-lg border border-[var(--border-color)] flex items-center justify-center bg-[var(--bg-secondary)]">
              <Loader2 className="w-5 h-5 animate-spin text-red-500" />
            </div>
          ))}

          <button
            type="button"
            onClick={() => fileInputRef.current?.click()}
            className="aspect-square border-2 border-dashed border-[var(--border-color)] rounded-lg flex flex-col items-center justify-center gap-1.5 hover:border-red-600/60 hover:bg-[var(--bg-card-hover)] transition-colors"
          >
            <ImagePlus className="w-5 h-5 text-[var(--text-muted)]" />
            <span className="text-[var(--text-muted)] text-[10px]">Add more</span>
          </button>
        </div>
      )}
    </div>
  );
}
