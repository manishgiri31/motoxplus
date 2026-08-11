import { PutObjectCommand } from "@aws-sdk/client-s3";
import { getR2Client, getR2Bucket, getR2PublicUrl } from "./r2";

export interface UploadResult {
  key: string;
  url: string;
  size: number;
}

export interface ProductImageUploadResult {
  original: UploadResult;
  medium: UploadResult;
  thumbnail: UploadResult;
}

/** Upload a raw buffer to R2. */
export async function uploadBuffer(
  buffer: Buffer,
  key: string,
  contentType: string,
  cacheControl = "public, max-age=31536000, immutable"
): Promise<UploadResult> {
  await getR2Client().send(
    new PutObjectCommand({
      Bucket: getR2Bucket(),
      Key: key,
      Body: buffer,
      ContentType: contentType,
      CacheControl: cacheControl,
    })
  );
  return {
    key,
    url: `${getR2PublicUrl()}/${key}`,
    size: buffer.byteLength,
  };
}

/**
 * Upload a product image with WebP conversion and 3 variants.
 * Uses sharp for conversion and resize.
 *
 * Only falls back to a raw upload if the sharp *module* can't be loaded at
 * all (e.g. its native binary missing for this platform) — callers are
 * expected to have already confirmed the buffer decodes as a real image
 * (see lib/storage/validate.ts) before reaching here, so a decode/convert
 * failure on an already-loaded sharp module is treated as a real error
 * instead of silently storing unprocessed, unvalidated bytes.
 */
export async function uploadProductImage(
  inputBuffer: Buffer,
  keys: { orig: string; med: string; thumb: string }
): Promise<ProductImageUploadResult> {
  let sharp: (typeof import("sharp"))["default"];
  try {
    sharp = (await import("sharp")).default;
  } catch {
    const [original, medium, thumbnail] = await Promise.all([
      uploadBuffer(inputBuffer, keys.orig, "image/webp"),
      uploadBuffer(inputBuffer, keys.med, "image/webp"),
      uploadBuffer(inputBuffer, keys.thumb, "image/webp"),
    ]);
    return { original, medium, thumbnail };
  }

  const [origBuf, medBuf, thumbBuf] = await Promise.all([
    sharp(inputBuffer)
      .resize({ width: 2400, height: 2400, fit: "inside", withoutEnlargement: true })
      .webp({ quality: 90 })
      .toBuffer(),
    sharp(inputBuffer)
      .resize({ width: 900, height: 900, fit: "inside", withoutEnlargement: true })
      .webp({ quality: 85 })
      .toBuffer(),
    sharp(inputBuffer)
      .resize({ width: 300, height: 300, fit: "cover" })
      .webp({ quality: 80 })
      .toBuffer(),
  ]);

  const [original, medium, thumbnail] = await Promise.all([
    uploadBuffer(origBuf, keys.orig, "image/webp"),
    uploadBuffer(medBuf, keys.med, "image/webp"),
    uploadBuffer(thumbBuf, keys.thumb, "image/webp"),
  ]);

  return { original, medium, thumbnail };
}

/** Upload a PDF document to R2 (private, no cache headers). */
export async function uploadPdf(
  buffer: Buffer,
  key: string
): Promise<UploadResult> {
  return uploadBuffer(buffer, key, "application/pdf", "private, no-cache");
}

/** Upload a generic file (dealer docs, company assets). */
export async function uploadFile(
  buffer: Buffer,
  key: string,
  mimeType: string,
  isPrivate = false
): Promise<UploadResult> {
  const cacheControl = isPrivate
    ? "private, no-cache"
    : "public, max-age=86400";
  return uploadBuffer(buffer, key, mimeType, cacheControl);
}
