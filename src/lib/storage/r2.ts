import { S3Client } from "@aws-sdk/client-s3";

function requireEnv(key: string): string {
  const val = process.env[key];
  if (!val || val.startsWith("your_") || val.startsWith("your-")) {
    throw new Error(
      `[Storage] Missing or placeholder environment variable: ${key}\n` +
      `Set it in .env — see SETUP.md for Cloudflare R2 instructions.`
    );
  }
  return val;
}

function buildClient(): S3Client {
  const accountId = requireEnv("R2_ACCOUNT_ID");
  const accessKeyId = requireEnv("R2_ACCESS_KEY_ID");
  const secretAccessKey = requireEnv("R2_SECRET_ACCESS_KEY");

  return new S3Client({
    region: "auto",
    endpoint: `https://${accountId}.r2.cloudflarestorage.com`,
    credentials: { accessKeyId, secretAccessKey },
  });
}

// Lazy singleton — only throws at call time, not import time
let _client: S3Client | null = null;
export function getR2Client(): S3Client {
  if (!_client) _client = buildClient();
  return _client;
}

export function getR2Bucket(): string {
  return requireEnv("R2_BUCKET_NAME");
}

export function getR2PublicUrl(): string {
  const url = requireEnv("R2_PUBLIC_URL");
  return url.replace(/\/$/, ""); // strip trailing slash
}
