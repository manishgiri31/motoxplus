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
 * Falls back to raw upload if sharp fails.
 */
export async function uploadProductImage(
  inputBuffer: Buffer,
  keys: { orig: string; med: string; thumb: string }
): Promise<ProductImageUploadResult> {
  let origBuf: Buffer;
  let medBuf: Buffer;
  let thumbBuf: Buffer;

  try {
    const sharp = (await import("sharp")).default;

    [origBuf, medBuf, thumbBuf] = await Promise.all([
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
  } catch {
    // Sharp unavailable — upload as-is (still works, just no optimization)
    origBuf = inputBuffer;
    medBuf = inputBuffer;
    thumbBuf = inputBuffer;
  }

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
