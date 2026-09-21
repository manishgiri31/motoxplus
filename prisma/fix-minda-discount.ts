/**
 * One-off maintenance: repriced Minda-brand products from 20% off MRP to
 * 50% off MRP (price = MRP * 0.50, snapped to the charm-pricing convention —
 * see src/lib/pricing/charm-price.ts). There's no per-brand discount rule
 * anywhere in the app; each product's price is just a stored number, so
 * this script is the one-time correction. Matches products by brand
 * containing "minda" (case-insensitive). Skips products with no MRP set.
 *
 * Run: npm run db:fix-minda-discount
 */

import { Prisma, PrismaClient } from "@prisma/client";

const prisma = new PrismaClient();

const MAX_RETRIES = 5;
const TRANSIENT_REQUEST_ERROR_CODES = new Set(["P1001", "P1002", "P1008", "P1017", "P2024"]);

function isTransientConnectionError(err: unknown): boolean {
  if (err instanceof Prisma.PrismaClientInitializationError) return true;
  if (err instanceof Prisma.PrismaClientKnownRequestError) {
    return TRANSIENT_REQUEST_ERROR_CODES.has(err.code);
  }
  return false;
}

function sleep(ms: number): Promise<void> {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

async function withRetry<T>(label: string, fn: () => Promise<T>): Promise<T> {
  for (let attempt = 0; attempt <= MAX_RETRIES; attempt++) {
    try {
      return await fn();
    } catch (err) {
      if (attempt === MAX_RETRIES || !isTransientConnectionError(err)) throw err;
      const delayMs = 1000 * 2 ** attempt + Math.random() * 300;
      console.warn(`Connection lost. Retry ${attempt + 1}/${MAX_RETRIES} after ${(delayMs / 1000).toFixed(1)}s... (${label})`);
      await sleep(delayMs);
    }
  }
  throw new Error("unreachable");
}

const LAST_DIGIT_DELTA = [-1, 2, 1, 0, -1, 1, 0, 0, 1, 0] as const;

function roundToCharmPrice(value: number): number {
  const rounded = Math.round(value);
  return rounded + LAST_DIGIT_DELTA[((rounded % 10) + 10) % 10];
}

async function main(): Promise<void> {
  const products = await withRetry("fetch Minda products", () =>
    prisma.product.findMany({
      where: { brand: { contains: "minda", mode: "insensitive" } },
      select: { id: true, sku: true, name: true, price: true, mrp: true },
    })
  );

  console.log(`Found ${products.length} Minda-brand product(s).`);

  let updated = 0;
  let unchanged = 0;
  let skippedNoMrp = 0;
  let failed = 0;

  for (const product of products) {
    if (product.mrp == null) {
      skippedNoMrp += 1;
      console.warn(`  ⚠ ${product.sku} (${product.name}) has no MRP — skipped`);
      continue;
    }

    const newPrice = roundToCharmPrice(product.mrp * 0.5);
    if (newPrice === product.price) {
      unchanged += 1;
      continue;
    }

    try {
      await withRetry(product.sku, () =>
        prisma.product.update({
          where: { id: product.id },
          data: { price: newPrice },
        })
      );
      updated += 1;
      console.log(`  ✓ ${product.sku}: ₹${product.price} -> ₹${newPrice} (MRP ₹${product.mrp})`);
    } catch (err) {
      failed += 1;
      const message = err instanceof Error ? err.message : String(err);
      console.error(`  ✗ ${product.sku} failed: ${message}`);
    }
  }

  console.log("\n=== Minda Discount Fix Summary ===");
  console.log(`Updated:      ${updated}`);
  console.log(`Unchanged:    ${unchanged}`);
  console.log(`Skipped (no MRP): ${skippedNoMrp}`);
  console.log(`Failed:       ${failed}`);
  console.log(`Total:        ${products.length}`);

  if (failed > 0) process.exitCode = 1;
}

async function run(): Promise<void> {
  try {
    await main();
  } catch (err) {
    console.error("Fatal error:", err);
    process.exitCode = 1;
  } finally {
    await prisma.$disconnect();
  }
}

run();
