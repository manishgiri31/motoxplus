/**
 * One-off maintenance: rounds every Product.price up to the nearest odd
 * whole rupee (no decimals, last digit never even) — same charm-pricing
 * convention already used by the cable seed script. Skips products whose
 * price is already an odd whole number.
 *
 * Run: npm run db:fix-odd-prices
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

function roundUpToOddWhole(value: number): number {
  const ceiled = Math.ceil(value);
  return ceiled % 2 === 0 ? ceiled + 1 : ceiled;
}

async function main(): Promise<void> {
  const products = await withRetry("fetch products", () =>
    prisma.product.findMany({ select: { id: true, sku: true, price: true } })
  );

  console.log(`Checking ${products.length} products...`);

  let updated = 0;
  let unchanged = 0;
  let failed = 0;

  for (const product of products) {
    const newPrice = roundUpToOddWhole(product.price);
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
    } catch (err) {
      failed += 1;
      const message = err instanceof Error ? err.message : String(err);
      console.error(`  ✗ ${product.sku} failed: ${message}`);
    }
  }

  console.log("\n=== Price Fix Summary ===");
  console.log(`Updated:   ${updated}`);
  console.log(`Unchanged: ${unchanged}`);
  console.log(`Failed:    ${failed}`);
  console.log(`Total:     ${products.length}`);

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
