"use client";

import { forwardRef, useCallback, useImperativeHandle, useRef, useState } from "react";
import Image from "next/image";
import { GripVertical, ImagePlus, Star, Trash2, Upload, X } from "lucide-react";

export interface UploaderImage {
  id?: string;
  url: string;
  mediumUrl?: string;
  thumbnailUrl?: string;
  key: string;
  fileName?: string;
  fileSize?: number;
  mimeType?: string;
  isPrimary: boolean;
  sortOrder: number;
  status: "ready" | "uploading" | "error";
  errorMsg?: string;
}

export interface ImageUploaderRef {
  getImages: () => UploaderImage[];
  getDeletedKeys: () => string[];
}

interface InitialImage {
  id: string;
  imageUrl: string;
  mediumUrl?: string | null;
  thumbnailUrl?: string | null;
  key: string;
  fileName?: string;
  fileSize?: number;
  mimeType?: string;
  isPrimary: boolean;
  sortOrder: number;
}

interface Props {
  initialImages?: InitialImage[];
  productId?: string;
}

export const ProductImageUploader = forwardRef<ImageUploaderRef, Props>(function ProductImageUploader(
  { initialImages = [], productId },
  ref
) {
  const [images, setImages] = useState<UploaderImage[]>(() =>
    initialImages
      .sort((a, b) => (a.isPrimary ? -1 : b.isPrimary ? 1 : a.sortOrder - b.sortOrder))
      .map((img) => ({
        id: img.id,
        url: img.imageUrl,
        mediumUrl: img.mediumUrl ?? undefined,
        thumbnailUrl: img.thumbnailUrl ?? undefined,
        key: img.key,
        fileName: img.fileName,
        fileSize: img.fileSize,
        mimeType: img.mimeType,
        isPrimary: img.isPrimary,
        sortOrder: img.sortOrder,
        status: "ready" as const,
      }))
  );
  const [deletedKeys, setDeletedKeys] = useState<string[]>([]);
  const [isDragOver, setIsDragOver] = useState(false);
  const fileInputRef = useRef<HTMLInputElement>(null);
  const dragCard = useRef<number | null>(null);
  const dragOverCard = useRef<number | null>(null);

  useImperativeHandle(ref, () => ({
    getImages: () => images.filter((i) => i.status !== "error"),
    getDeletedKeys: () => deletedKeys,
  }));

  const uploadFile = useCallback(async (file: File, insertAt: number) => {
    const tempId = `temp-${Date.now()}-${Math.random()}`;
    const localPreview = URL.createObjectURL(file);
    const placeholder: UploaderImage = {
      url: localPreview,
      key: tempId,
      isPrimary: false,
      sortOrder: insertAt,
      status: "uploading",
    };

    setImages((prev) => {
      const next = [...prev, placeholder];
      if (next.filter((i) => i.status !== "error").length === 1) {
        next[next.length - 1].isPrimary = true;
      }
      return next;
    });

    try {
      const fd = new FormData();
      fd.append("file", file);
      if (productId) fd.append("productId", productId);

      const res = await fetch("/api/upload/product-image", { method: "POST", body: fd });
      const data = await res.json();

      if (!res.ok) throw new Error(data.error || "Upload failed");

      setImages((prev) =>
        prev.map((img) =>
          img.key === tempId
            ? {
                ...img,
                url: data.url,
                mediumUrl: data.mediumUrl,
                thumbnailUrl: data.thumbnailUrl,
                key: data.key,
                fileName: data.fileName,
                fileSize: data.fileSize,
                mimeType: data.mimeType,
                status: "ready",
              }
            : img
        )
      );
    } catch (err: any) {
      setImages((prev) =>
        prev.map((img) =>
          img.key === tempId
            ? { ...img, status: "error", errorMsg: err.message }
            : img
        )
      );
    }
  }, [productId]);

  const handleFiles = useCallback(
    (files: FileList | null) => {
      if (!files) return;
      Array.from(files).forEach((file, i) => {
        uploadFile(file, images.length + i);
      });
    },
    [images.length, uploadFile]
  );

  const onDropZone = useCallback(
    (e: React.DragEvent) => {
      e.preventDefault();
      setIsDragOver(false);
      if (e.dataTransfer.types.includes("Files")) {
        handleFiles(e.dataTransfer.files);
      }
    },
    [handleFiles]
  );

  const setPrimary = (idx: number) => {
    setImages((prev) => prev.map((img, i) => ({ ...img, isPrimary: i === idx })));
  };

  const removeImage = (idx: number) => {
    setImages((prev) => {
      const img = prev[idx];
      if (img.key && !img.key.startsWith("temp-")) {
        setDeletedKeys((dk) => [...dk, img.key]);
      }
      const next = prev.filter((_, i) => i !== idx);
      if (img.isPrimary && next.length > 0) {
        next[0].isPrimary = true;
      }
      return next.map((img, i) => ({ ...img, sortOrder: i }));
    });
  };

  const removeError = (idx: number) => {
    setImages((prev) => prev.filter((_, i) => i !== idx));
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
      return next.map((img, i) => ({ ...img, sortOrder: i }));
    });
    dragCard.current = null;
    dragOverCard.current = null;
  };

  const readyImages = images.filter((i) => i.status !== "error");
  const uploading = images.some((i) => i.status === "uploading");

  return (
    <div className="space-y-3">
      {/* Drop zone */}
      <div
        onDragOver={(e) => { e.preventDefault(); if (e.dataTransfer.types.includes("Files")) setIsDragOver(true); }}
        onDragLeave={() => setIsDragOver(false)}
        onDrop={onDropZone}
        onClick={() => fileInputRef.current?.click()}
        className={`border-2 border-dashed rounded-sm p-8 text-center cursor-pointer transition-colors ${
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
        <Upload className="w-8 h-8 text-[var(--text-muted)] mx-auto mb-2" />
        <p className="text-[var(--text-secondary)] text-sm font-medium">
          Drop images here or <span className="text-red-500">click to upload</span>
        </p>
        <p className="text-[var(--text-muted)] text-xs mt-1">
          JPG, PNG, WEBP — max 5 MB each — auto-converted to WebP
        </p>
      </div>

      {/* Image grid */}
      {images.length > 0 && (
        <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-4 gap-3">
          {images.map((img, idx) => (
            <div
              key={img.key}
              draggable={img.status === "ready"}
              onDragStart={() => onCardDragStart(idx)}
              onDragEnter={() => onCardDragEnter(idx)}
              onDragEnd={onCardDragEnd}
              onDragOver={(e) => e.preventDefault()}
              className={`relative group rounded-sm overflow-hidden border aspect-square ${
                img.status === "error"
                  ? "border-red-500/50 bg-red-500/10"
                  : img.isPrimary
                  ? "border-yellow-500/60"
                  : "border-[var(--border-color)]"
              } ${img.status === "ready" ? "cursor-grab active:cursor-grabbing" : ""}`}
            >
              <Image
                src={img.thumbnailUrl || img.url}
                alt="Product image"
                fill
                className={`object-cover ${img.status === "uploading" ? "opacity-40" : "opacity-100"} transition-opacity`}
                sizes="200px"
                unoptimized
              />

              {img.status === "uploading" && (
                <div className="absolute inset-0 flex items-center justify-center bg-black/40">
                  <div className="w-6 h-6 border-2 border-white border-t-transparent rounded-full animate-spin" />
                </div>
              )}

              {img.status === "error" && (
                <div className="absolute inset-0 flex flex-col items-center justify-center bg-red-900/80 p-2">
                  <p className="text-red-200 text-xs text-center leading-tight">{img.errorMsg}</p>
                  <button
                    type="button"
                    onClick={() => removeError(idx)}
                    className="mt-2 text-red-300 hover:text-white"
                  >
                    <X className="w-4 h-4" />
                  </button>
                </div>
              )}

              {img.status === "ready" && (
                <>
                  {img.isPrimary && (
                    <div className="absolute top-1 left-1 bg-yellow-500 rounded-sm px-1.5 py-0.5 flex items-center gap-1">
                      <Star className="w-2.5 h-2.5 fill-black text-black" />
                      <span className="text-black text-[10px] font-bold">PRIMARY</span>
                    </div>
                  )}

                  <div className="absolute top-1 right-1 opacity-0 group-hover:opacity-100 transition-opacity">
                    <GripVertical className="w-4 h-4 text-white drop-shadow" />
                  </div>

                  <div className="absolute bottom-0 left-0 right-0 bg-gradient-to-t from-black/80 to-transparent p-1.5 opacity-0 group-hover:opacity-100 transition-opacity flex justify-between items-center">
                    <button
                      type="button"
                      title="Set as primary"
                      onClick={() => setPrimary(idx)}
                      disabled={img.isPrimary}
                      className={`text-xs flex items-center gap-1 ${img.isPrimary ? "text-yellow-400" : "text-white hover:text-yellow-300"}`}
                    >
                      <Star className={`w-3.5 h-3.5 ${img.isPrimary ? "fill-yellow-400" : ""}`} />
                    </button>
                    <button
                      type="button"
                      title="Remove"
                      onClick={() => removeImage(idx)}
                      className="text-red-400 hover:text-red-300"
                    >
                      <Trash2 className="w-3.5 h-3.5" />
                    </button>
                  </div>
                </>
              )}
            </div>
          ))}

          <button
            type="button"
            onClick={() => fileInputRef.current?.click()}
            className="aspect-square border-2 border-dashed border-[var(--border-color)] rounded-sm flex flex-col items-center justify-center gap-2 hover:border-red-600/60 hover:bg-[var(--bg-card-hover)] transition-colors"
          >
            <ImagePlus className="w-6 h-6 text-[var(--text-muted)]" />
            <span className="text-[var(--text-muted)] text-xs">Add more</span>
          </button>
        </div>
      )}

      {uploading && (
        <p className="text-[var(--text-muted)] text-xs">Uploading — please wait before saving...</p>
      )}

      {readyImages.length > 0 && (
        <p className="text-[var(--text-muted)] text-xs">
          {readyImages.length} image{readyImages.length !== 1 ? "s" : ""} — drag to reorder, star to set primary
        </p>
      )}
    </div>
  );
});
