// Backward-compat shims — new code should import from @/lib/storage
import { uploadBuffer } from "./storage/upload";
import { deleteFile } from "./storage/delete";
import { generateSignedUrl } from "./storage/signed";

export async function uploadToR2(buffer: Buffer, key: string, contentType: string): Promise<string> {
  const result = await uploadBuffer(buffer, key, contentType);
  return result.url;
}

export async function deleteFromR2(key: string): Promise<void> {
  return deleteFile(key);
}

export async function getPresignedUploadUrl(key: string, _contentType: string): Promise<string> {
  return generateSignedUrl(key);
}
