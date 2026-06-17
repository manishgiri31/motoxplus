import { DeleteObjectCommand, DeleteObjectsCommand } from "@aws-sdk/client-s3";
import { getR2Client, getR2Bucket } from "./r2";

/** Delete a single object by key. Silently ignores 404 (already deleted). */
export async function deleteFile(key: string): Promise<void> {
  if (!key) return;
  try {
    await getR2Client().send(
      new DeleteObjectCommand({ Bucket: getR2Bucket(), Key: key })
    );
  } catch (err: any) {
    if (err?.name === "NoSuchKey") return;
    throw err;
  }
}

/**
 * Delete a product image and all its variants.
 * Derives medium and thumb keys from the original key.
 */
export async function deleteProductImage(origKey: string): Promise<void> {
  if (!origKey) return;
  // origKey: products/{id}/uuid.webp
  // med key: products/{id}/uuid_med.webp
  // thumb key: products/{id}/uuid_thumb.webp
  const base = origKey.replace(/\.webp$/, "");
  const keys = [origKey, `${base}_med.webp`, `${base}_thumb.webp`].filter(Boolean);

  try {
    await getR2Client().send(
      new DeleteObjectsCommand({
        Bucket: getR2Bucket(),
        Delete: { Objects: keys.map((Key) => ({ Key })), Quiet: true },
      })
    );
  } catch {
    // Best-effort — proceed even if delete fails
  }
}

/** Batch delete up to 1000 keys at once. */
export async function deleteFiles(keys: string[]): Promise<void> {
  const valid = keys.filter(Boolean);
  if (!valid.length) return;

  const chunks: string[][] = [];
  for (let i = 0; i < valid.length; i += 1000) {
    chunks.push(valid.slice(i, i + 1000));
  }

  await Promise.all(
    chunks.map((chunk) =>
      getR2Client().send(
        new DeleteObjectsCommand({
          Bucket: getR2Bucket(),
          Delete: { Objects: chunk.map((Key) => ({ Key })), Quiet: true },
        })
      )
    )
  );
}
