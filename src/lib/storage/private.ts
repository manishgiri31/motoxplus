import { PutObjectCommand } from "@aws-sdk/client-s3";
import { getR2Bucket, getR2Client, getR2PrivateBucket } from "./r2";
import { uploadFile } from "./upload";
import { generateSignedUrl } from "./signed";
import { deleteFile } from "./delete";

/**
 * Private documents (KYC: PAN, GST certificate, bank proof, business proof).
 *
 * They go to a separate R2 bucket with public access OFF (`R2_PRIVATE_BUCKET_NAME`). The database row stores
 * `r2-private://<key>` instead of a public URL, so nothing that reads `fileUrl` can hand out a working link;
 * the only way to view a document is a short-lived signed URL from `signStoredFile`.
 *
 * Rows written before this existed hold a public `R2_PUBLIC_URL/<key>` value and still live in the public bucket.
 * `bucketForStoredFile` routes them there until `scripts/storage/move-documents-private.ts` moves them.
 */
export const PRIVATE_URL_PREFIX = "r2-private://";

export function isPrivateStoredUrl(fileUrl: string | null | undefined): boolean {
  return !!fileUrl && fileUrl.startsWith(PRIVATE_URL_PREFIX);
}

let warnedFallback = false;

/** Uploads a private document. Returns the value to store in `fileUrl`. */
export async function uploadPrivateDocument(
  buffer: Buffer,
  key: string,
  contentType: string
): Promise<{ key: string; storedUrl: string; size: number; isPrivate: boolean }> {
  const bucket = getR2PrivateBucket();
  if (!bucket) {
    // Keeps uploads working until the bucket is configured, but this is the old, publicly reachable behaviour.
    if (!warnedFallback) {
      console.warn("[Storage] R2_PRIVATE_BUCKET_NAME is not set: private documents are being stored in the PUBLIC bucket.");
      warnedFallback = true;
    }
    const legacy = await uploadFile(buffer, key, contentType, true);
    return { key, storedUrl: legacy.url, size: legacy.size, isPrivate: false };
  }

  await getR2Client().send(
    new PutObjectCommand({
      Bucket: bucket,
      Key: key,
      Body: buffer,
      ContentType: contentType,
      CacheControl: "private, no-store",
    })
  );
  return { key, storedUrl: `${PRIVATE_URL_PREFIX}${key}`, size: buffer.byteLength, isPrivate: true };
}

/** Which bucket a stored document lives in, from its `fileUrl` value. */
export function bucketForStoredFile(fileUrl: string | null | undefined): string {
  if (!isPrivateStoredUrl(fileUrl)) return getR2Bucket();
  const bucket = getR2PrivateBucket();
  if (!bucket) throw new Error("[Storage] Document is in the private bucket but R2_PRIVATE_BUCKET_NAME is not set");
  return bucket;
}

/** Short-lived link to view a stored document. */
export function signStoredFile(key: string, fileUrl: string | null | undefined, expiresInSeconds = 300): Promise<string> {
  return generateSignedUrl(key, expiresInSeconds, bucketForStoredFile(fileUrl));
}

export function deleteStoredFile(key: string, fileUrl: string | null | undefined): Promise<void> {
  return deleteFile(key, bucketForStoredFile(fileUrl));
}
