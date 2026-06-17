/**
 * MOTOXPLUS Storage Layer
 * Cloudflare R2 — S3 Compatible API
 *
 * Required environment variables:
 *   R2_ACCOUNT_ID       — Cloudflare account ID (32-char hex)
 *   R2_ACCESS_KEY_ID    — R2 API token access key
 *   R2_SECRET_ACCESS_KEY— R2 API token secret
 *   R2_BUCKET_NAME      — Bucket name (e.g. motoxplus-assets)
 *   R2_PUBLIC_URL       — Public bucket URL (e.g. https://pub-xxx.r2.dev)
 */

export { getR2Client, getR2Bucket, getR2PublicUrl } from "./r2";
export { folders, newUUID, extFromMime } from "./folders";
export { uploadBuffer, uploadProductImage, uploadPdf, uploadFile } from "./upload";
export type { UploadResult, ProductImageUploadResult } from "./upload";
export { deleteFile, deleteProductImage, deleteFiles } from "./delete";
export { generateSignedUrl } from "./signed";
export { logStorageAction } from "./audit";
export type { AuditAction } from "./audit";

// Allowed MIME types for product images
export const IMAGE_MIME_TYPES = new Set([
  "image/jpeg",
  "image/jpg",
  "image/png",
  "image/webp",
]);

// Allowed MIME types for dealer documents
export const DOCUMENT_MIME_TYPES = new Set([
  "application/pdf",
  "image/jpeg",
  "image/jpg",
  "image/png",
]);

export const MAX_IMAGE_SIZE = 5 * 1024 * 1024;    // 5 MB
export const MAX_DOCUMENT_SIZE = 10 * 1024 * 1024; // 10 MB
export const MAX_CATALOG_SIZE = 50 * 1024 * 1024;  // 50 MB
