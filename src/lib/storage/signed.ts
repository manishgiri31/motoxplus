import { GetObjectCommand } from "@aws-sdk/client-s3";
import { getSignedUrl } from "@aws-sdk/s3-request-presigner";
import { getR2Client, getR2Bucket } from "./r2";

const DEFAULT_EXPIRY_SECONDS = 15 * 60; // 15 minutes

/**
 * Generate a time-limited signed URL for private R2 objects.
 * Used for dealer documents, export files, etc.
 */
export async function generateSignedUrl(
  key: string,
  expiresInSeconds = DEFAULT_EXPIRY_SECONDS
): Promise<string> {
  const command = new GetObjectCommand({
    Bucket: getR2Bucket(),
    Key: key,
  });
  return getSignedUrl(getR2Client(), command, { expiresIn: expiresInSeconds });
}
