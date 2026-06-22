/**
 * Seed product images — generates a branded placeholder image for each
 * product that has no image, uploads all three variants to Cloudflare R2,
 * and saves the ProductImage record in the database.
 *
 * Run:  npx tsx scripts/seed-product-images.ts
 */

import { PrismaClient } from "@prisma/client";
import { S3Client, PutObjectCommand } from "@aws-sdk/client-s3";
import { randomUUID } from "crypto";
import * as dotenv from "dotenv";

dotenv.config();

const prisma = new PrismaClient();

// ---------------------------------------------------------------------------
// R2 helpers
// ---------------------------------------------------------------------------

function makeR2Client() {
  return new S3Client({
    region: "auto",
    endpoint: `https://${process.env.R2_ACCOUNT_ID}.r2.cloudflarestorage.com`,
    credentials: {
      accessKeyId: process.env.R2_ACCESS_KEY_ID!,
      secretAccessKey: process.env.R2_SECRET_ACCESS_KEY!,
    },
  });
}

async function uploadBuffer(
  client: S3Client,
  buffer: Buffer,
  key: string
): Promise<string> {
  await client.send(
    new PutObjectCommand({
      Bucket: process.env.R2_BUCKET_NAME!,
      Key: key,
      Body: buffer,
      ContentType: "image/webp",
      CacheControl: "public, max-age=31536000, immutable",
    })
  );
  return `${process.env.R2_PUBLIC_URL!.replace(/\/$/, "")}/${key}`;
}

// ---------------------------------------------------------------------------
// Image generation via Sharp + SVG
// ---------------------------------------------------------------------------

// Category → brand accent colour
const CATEGORY_COLORS: Record<string, string> = {
  "brake parts":        "#DC2626",
  "engine parts":       "#F59E0B",
  "suspension parts":   "#10B981",
  "electrical parts":   "#3B82F6",
  "transmission parts": "#8B5CF6",
  "body parts":         "#EC4899",
};

function pickColor(categoryName: string): string {
  const key = categoryName.toLowerCase();
  for (const [cat, color] of Object.entries(CATEGORY_COLORS)) {
    if (key.includes(cat) || cat.includes(key.split(" ")[0])) return color;
  }
  return "#DC2626"; // default red
}

/** Wrap long text to fit inside the SVG */
function wrapText(text: string, maxChars = 22): string[] {
  const words = text.split(" ");
  const lines: string[] = [];
  let line = "";
  for (const word of words) {
    if ((line + " " + word).trim().length > maxChars) {
      if (line) lines.push(line.trim());
      line = word;
    } else {
      line = (line + " " + word).trim();
    }
  }
  if (line) lines.push(line.trim());
  return lines.slice(0, 3); // max 3 lines
}

/**
 * Build an SVG product card image (800×800) and return a sharp WebP buffer.
 * Uses only SVG primitives (no external fonts / assets).
 */
async function generateProductImage(
  productName: string,
  categoryName: string,
  partNumber: string,
  width: number,
  height: number,
  quality: number
): Promise<Buffer> {
  const sharp = (await import("sharp")).default;
  const accent = pickColor(categoryName);
  const lines = wrapText(productName);
  const lineHeight = 48;
  const textBlockHeight = lines.length * lineHeight;
  const textY = height / 2 - textBlockHeight / 2 + 20;

  const textElements = lines
    .map(
      (line, i) =>
        `<text x="400" y="${textY + i * lineHeight}"
               font-family="Arial,Helvetica,sans-serif"
               font-size="36" font-weight="bold" fill="white"
               text-anchor="middle" dominant-baseline="middle">${escXml(line)}</text>`
    )
    .join("\n");

  const svg = `
<svg xmlns="http://www.w3.org/2000/svg" width="${width}" height="${height}" viewBox="0 0 ${width} ${height}">
  <defs>
    <linearGradient id="bg" x1="0" y1="0" x2="1" y2="1">
      <stop offset="0%"   stop-color="#0A0A0A"/>
      <stop offset="100%" stop-color="#1A1A1A"/>
    </linearGradient>
    <linearGradient id="stripe" x1="0" y1="0" x2="1" y2="0">
      <stop offset="0%" stop-color="${accent}" stop-opacity="0.15"/>
      <stop offset="100%" stop-color="${accent}" stop-opacity="0"/>
    </linearGradient>
  </defs>

  <!-- Background -->
  <rect width="${width}" height="${height}" fill="url(#bg)"/>

  <!-- Subtle diagonal accent stripes -->
  <rect x="-${width}" y="${height * 0.35}" width="${width * 3}" height="${height * 0.3}"
        fill="url(#stripe)" transform="rotate(-20 ${width / 2} ${height / 2})"/>

  <!-- Top accent bar -->
  <rect x="0" y="0" width="${width}" height="6" fill="${accent}"/>

  <!-- Centre diamond logo -->
  <text x="400" y="${textY - 80}"
        font-family="Arial,Helvetica,sans-serif"
        font-size="72" fill="${accent}" text-anchor="middle" dominant-baseline="middle"
        opacity="0.6">◈</text>

  <!-- Product name -->
  ${textElements}

  <!-- Part number tag -->
  <rect x="${width / 2 - 100}" y="${textY + textBlockHeight + 20}"
        width="200" height="30" rx="4"
        fill="${accent}" opacity="0.15"/>
  <text x="400" y="${textY + textBlockHeight + 35}"
        font-family="Arial,Helvetica,sans-serif"
        font-size="14" fill="${accent}" text-anchor="middle" dominant-baseline="middle"
        letter-spacing="2">${escXml(partNumber)}</text>

  <!-- Category label (bottom-left) -->
  <text x="24" y="${height - 24}"
        font-family="Arial,Helvetica,sans-serif"
        font-size="13" fill="#666666" dominant-baseline="auto"
        letter-spacing="1">${escXml(categoryName.toUpperCase())}</text>

  <!-- Brand tag (bottom-right) -->
  <text x="${width - 24}" y="${height - 24}"
        font-family="Arial,Helvetica,sans-serif"
        font-size="13" font-weight="bold" fill="${accent}"
        text-anchor="end" dominant-baseline="auto" letter-spacing="2">MOTOXPLUS</text>

  <!-- Bottom border -->
  <rect x="0" y="${height - 4}" width="${width}" height="4" fill="${accent}" opacity="0.4"/>
</svg>`.trim();

  return sharp(Buffer.from(svg))
    .resize(width, height)
    .webp({ quality })
    .toBuffer();
}

function escXml(s: string): string {
  return s
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;");
}

// ---------------------------------------------------------------------------
// Main
// ---------------------------------------------------------------------------

async function main() {
  console.log("🚀  MotoXPlus — Cloudflare R2 image seeder\n");

  const required = [
    "R2_ACCOUNT_ID","R2_ACCESS_KEY_ID","R2_SECRET_ACCESS_KEY",
    "R2_BUCKET_NAME","R2_PUBLIC_URL",
  ];
  for (const k of required) {
    if (!process.env[k]) { console.error(`❌  Missing env var: ${k}`); process.exit(1); }
  }

  const r2 = makeR2Client();

  const products = await prisma.product.findMany({
    where: { isActive: true },
    include: { productImages: { take: 1 }, category: true },
    orderBy: { createdAt: "desc" },
  });

  console.log(`Found ${products.length} active product(s)\n`);

  let uploaded = 0, skipped = 0, failed = 0;

  for (const product of products) {
    if (product.productImages.length > 0) {
      console.log(`⏭  ${product.name} — already has image`);
      skipped++;
      continue;
    }

    console.log(`🎨  Generating image for: ${product.name}`);

    try {
      // Generate 3 variants locally using Sharp + SVG
      const [origBuf, medBuf, thumbBuf] = await Promise.all([
        generateProductImage(product.name, product.category.name, product.partNumber, 800, 800, 90),
        generateProductImage(product.name, product.category.name, product.partNumber, 400, 400, 85),
        generateProductImage(product.name, product.category.name, product.partNumber, 300, 300, 80),
      ]);

      const uuid = randomUUID();
      const origKey  = `products/${product.id}/${uuid}.webp`;
      const medKey   = `products/${product.id}/${uuid}_med.webp`;
      const thumbKey = `products/${product.id}/${uuid}_thumb.webp`;

      // Upload all three to R2
      const [origUrl, medUrl, thumbUrl] = await Promise.all([
        uploadBuffer(r2, origBuf, origKey),
        uploadBuffer(r2, medBuf, medKey),
        uploadBuffer(r2, thumbBuf, thumbKey),
      ]);

      // Save to database
      await prisma.productImage.create({
        data: {
          productId:    product.id,
          imageUrl:     origUrl,
          mediumUrl:    medUrl,
          thumbnailUrl: thumbUrl,
          key:          origKey,
          isPrimary:    true,
          sortOrder:    0,
          fileName:     `${product.sku}.webp`,
          fileSize:     origBuf.byteLength,
          mimeType:     "image/webp",
        },
      });

      console.log(`    ✅  ${origUrl}`);
      uploaded++;
    } catch (err: any) {
      console.error(`    ❌  ${err?.message ?? err}`);
      failed++;
    }

    console.log();
  }

  await prisma.$disconnect();

  console.log("─".repeat(60));
  console.log(`✅  Uploaded  : ${uploaded}`);
  console.log(`⏭  Skipped   : ${skipped}`);
  console.log(`❌  Failed    : ${failed}`);
  console.log("─".repeat(60));

  if (uploaded > 0) {
    console.log("\n🌐  Images are live at:");
    console.log(`    ${process.env.R2_PUBLIC_URL}`);
  }
}

main().catch((err) => { console.error(err); process.exit(1); });
