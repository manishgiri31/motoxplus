/**
 * Moves KYC documents (DealerDocument, VendorDocument) that were uploaded to the PUBLIC R2 bucket into the
 * private bucket (R2_PRIVATE_BUCKET_NAME), and points each row at it (`fileUrl = "r2-private://<key>"`).
 *
 * Usage (dry run is the default; nothing changes without --yes):
 *   npx ts-node --compiler-options '{"module":"CommonJS"}' scripts/storage/move-documents-private.ts
 *   npx ts-node --compiler-options '{"module":"CommonJS"}' scripts/storage/move-documents-private.ts --yes
 *   npx ts-node --compiler-options '{"module":"CommonJS"}' scripts/storage/move-documents-private.ts --yes --delete-public
 *
 * --yes            Copy each object to the private bucket, verify it is there with the same size, then update the row.
 * --delete-public  After a row is moved (in this run or an earlier one), delete the public copy. Run this only once
 *                  you have opened a few moved documents from the admin panel and they display correctly.
 *
 * Safe to re-run: moved rows are skipped for copying; a failure on one row never stops the others.
 */
import "dotenv/config";
import dotenv from "dotenv";
import { PrismaClient } from "@prisma/client";
import { CopyObjectCommand, DeleteObjectCommand, HeadObjectCommand, S3Client } from "@aws-sdk/client-s3";

dotenv.config({ path: ".env.local", override: true });

const APPLY = process.argv.includes("--yes");
const DELETE_PUBLIC = process.argv.includes("--delete-public");
const PREFIX = "r2-private://";

function env(name: string): string {
  const v = process.env[name]?.trim();
  if (!v || v.startsWith("your_") || v.startsWith("your-")) throw new Error(`Missing ${name}`);
  return v;
}

type Row = { table: "DealerDocument" | "VendorDocument"; id: string; key: string; fileUrl: string; fileSize: number };

async function main() {
  const publicBucket = env("R2_BUCKET_NAME");
  const privateBucket = env("R2_PRIVATE_BUCKET_NAME");
  if (publicBucket === privateBucket) throw new Error("R2_PRIVATE_BUCKET_NAME must differ from R2_BUCKET_NAME");

  const s3 = new S3Client({
    region: "auto",
    endpoint: `https://${env("R2_ACCOUNT_ID")}.r2.cloudflarestorage.com`,
    credentials: { accessKeyId: env("R2_ACCESS_KEY_ID"), secretAccessKey: env("R2_SECRET_ACCESS_KEY") },
  });
  const prisma = new PrismaClient();

  const select = { id: true, key: true, fileUrl: true, fileSize: true } as const;
  const rows: Row[] = [
    ...(await prisma.dealerDocument.findMany({ select })).map((r) => ({ ...r, table: "DealerDocument" as const })),
    ...(await prisma.vendorDocument.findMany({ select })).map((r) => ({ ...r, table: "VendorDocument" as const })),
  ];

  const pending = rows.filter((r) => r.key && !r.fileUrl.startsWith(PREFIX));
  const moved = rows.filter((r) => r.fileUrl.startsWith(PREFIX));
  const noKey = rows.filter((r) => !r.key);
  console.log(`${rows.length} documents: ${pending.length} to move, ${moved.length} already private, ${noKey.length} without a key (skipped).`);
  if (!APPLY) {
    for (const r of pending) console.log(`  would move ${r.table} ${r.id}  ${r.key}`);
    console.log("Dry run. Re-run with --yes to move them.");
    await prisma.$disconnect();
    return;
  }

  let ok = 0;
  let failed = 0;
  for (const r of pending) {
    try {
      await s3.send(new CopyObjectCommand({
        Bucket: privateBucket,
        Key: r.key,
        CopySource: `${publicBucket}/${encodeURIComponent(r.key).replace(/%2F/g, "/")}`,
        CacheControl: "private, no-store",
        MetadataDirective: "REPLACE",
      }));
      const head = await s3.send(new HeadObjectCommand({ Bucket: privateBucket, Key: r.key }));
      if (r.fileSize > 0 && head.ContentLength !== r.fileSize) {
        throw new Error(`size mismatch after copy (${head.ContentLength} vs ${r.fileSize})`);
      }
      const data = { fileUrl: `${PREFIX}${r.key}` };
      if (r.table === "DealerDocument") await prisma.dealerDocument.update({ where: { id: r.id }, data });
      else await prisma.vendorDocument.update({ where: { id: r.id }, data });
      moved.push({ ...r, fileUrl: data.fileUrl });
      ok++;
      console.log(`  moved ${r.table} ${r.id}`);
    } catch (e) {
      failed++;
      console.error(`  FAILED ${r.table} ${r.id}: ${e instanceof Error ? e.message : e}`);
    }
  }
  console.log(`Moved ${ok}, failed ${failed}.`);

  if (DELETE_PUBLIC) {
    let deleted = 0;
    for (const r of moved) {
      try {
        // Never delete the public copy unless the private one is confirmed present.
        await s3.send(new HeadObjectCommand({ Bucket: privateBucket, Key: r.key }));
        await s3.send(new DeleteObjectCommand({ Bucket: publicBucket, Key: r.key }));
        deleted++;
      } catch (e) {
        console.error(`  could not delete public copy of ${r.table} ${r.id}: ${e instanceof Error ? e.message : e}`);
      }
    }
    console.log(`Deleted ${deleted} public copies.`);
  }

  await prisma.$disconnect();
}

main().catch((e) => {
  console.error(e);
  process.exit(1);
});
