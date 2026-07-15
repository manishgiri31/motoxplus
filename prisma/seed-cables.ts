/**
 * Imports the friction-free cable catalog (clutch/throttle/brake/speedometer/
 * choke/seat-lock/gear cables across ~130 two-wheeler model groups) as
 * MOTOXPLUS products. Each source line becomes one Product with a
 * sequential MX-CB#### SKU/part number, a generated description, and
 * price = dealer Net Rate / mrp = printed MRP.
 *
 * Idempotent: every product is upserted by its unique `sku`, so running this
 * script any number of times updates the same 696 rows rather than creating
 * duplicates.
 *
 * Run: npm run db:seed-cables
 */

import { Prisma, PrismaClient } from "@prisma/client";
import { CABLE_SECTIONS } from "./data/cables-source";

const prisma = new PrismaClient();

const CATEGORY_SLUG = "cables";
const SKU_PREFIX = "MX-CB";

// --- Retry mechanism ---------------------------------------------------
//
// Railway's TCP proxy occasionally drops a connection attempt mid-script
// (observed directly: a live run failed to reach the DB on the very first
// query, then succeeded a moment later on retry). That failure surfaces as
// PrismaClientInitializationError (engine couldn't open a connection at all)
// or as PrismaClientKnownRequestError with a connection-level code — both are
// purely transport-layer and safe to retry blindly.
//
// Everything else (unique-constraint violations, missing-record errors,
// validation errors, programming errors) is a real problem with the data or
// the code, not the network, so it must fail immediately instead of being
// retried 5 times for no reason.
// Live verification against this project's Railway DB additionally surfaced
// P2024 ("Timed out fetching a new connection from the connection pool") —
// a pool-exhaustion symptom of the same proxy instability, not a data issue,
// so it belongs in the retryable set alongside the connection-level codes.
const MAX_RETRIES = 5;
const TRANSIENT_REQUEST_ERROR_CODES = new Set(["P1001", "P1002", "P1008", "P1017", "P2024"]);

function isTransientConnectionError(err: unknown): boolean {
  // Engine never managed to open a connection at all (e.g. a proxy blip)  —
  // this is never a data/schema issue, so it's always safe to retry.
  if (err instanceof Prisma.PrismaClientInitializationError) return true;
  // Query executed against an already-open connection but the connection
  // itself failed mid-flight. Only the connection-related codes qualify;
  // P2002 (unique constraint), P2003 (FK constraint), P2025 (record not
  // found), validation errors, etc. must never be retried.
  if (err instanceof Prisma.PrismaClientKnownRequestError) {
    return TRANSIENT_REQUEST_ERROR_CODES.has(err.code);
  }
  return false;
}

function sleep(ms: number): Promise<void> {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

/**
 * Retries `fn` on transient connection failures using exponential backoff
 * with jitter (1s, 2s, 4s, 8s, 16s + up to 300ms random jitter). Any
 * non-transient error is rethrown immediately on the first attempt.
 */
async function withRetry<T>(label: string, fn: () => Promise<T>): Promise<T> {
  for (let attempt = 0; attempt <= MAX_RETRIES; attempt++) {
    try {
      return await fn();
    } catch (err) {
      if (attempt === MAX_RETRIES || !isTransientConnectionError(err)) throw err;
      const backoffMs = 1000 * 2 ** attempt; // 1s, 2s, 4s, 8s, 16s
      const jitterMs = Math.random() * 300;
      const delayMs = backoffMs + jitterMs;
      console.warn("Connection lost.");
      console.warn(`  Retry ${attempt + 1}/${MAX_RETRIES} after ${(delayMs / 1000).toFixed(1)}s... (${label})`);
      await sleep(delayMs);
    }
  }
  /* istanbul ignore next -- loop above always returns or throws */
  throw new Error("unreachable");
}

// --- Cable type classification ------------------------------------------

interface TypeInfo {
  label: string;
  action: string;
}

interface ParsedItem {
  type: TypeInfo;
  vehicles: string[];
}

interface FailedItem {
  sku: string;
  name: string;
  error: string;
}

const TYPE_RULES: { re: RegExp; info: TypeInfo }[] = [
  { re: /^cable\s*kit/i, info: { label: "Cable Kit", action: "bundles the full set of control cables needed for a complete service in one pack" } },
  { re: /^clutch\s*\/\s*gear\s*outer/i, info: { label: "Clutch/Gear Outer Cable", action: "serves as a replacement outer casing with liner for clutch and gear cable assemblies" } },
  { re: /^seat\s*lock/i, info: { label: "Seat Lock Cable", action: "operates the seat lock mechanism for secure locking and unlocking of the seat" } },
  { re: /^spe?e?dor?\s*meter|^speedometer|^speedo\b|^spedometer/i, info: { label: "Speedometer Cable", action: "transmits rotational drive from the front wheel hub to the speedometer head for accurate speed and odometer readings" } },
  { re: /^front\s*(brake|barke)/i, info: { label: "Front Brake Cable", action: "connects the front brake lever to the drum brake mechanism for consistent lever feel and stopping response" } },
  { re: /^rear\s*brake/i, info: { label: "Rear Brake Cable", action: "connects the rear brake pedal or lever to the drum brake mechanism for reliable rear-wheel braking" } },
  { re: /^d\.?\s*comp/i, info: { label: "Decompression Cable", action: "operates the engine decompression valve for easier kickstarting" } },
  { re: /^gear\s*cable/i, info: { label: "Gear Cable", action: "operates the gear shift mechanism for smooth, precise gear changes" } },
  { re: /^choke/i, info: { label: "Choke Cable", action: "operates the carburetor choke plate for reliable cold starts" } },
  { re: /^clutch/i, info: { label: "Clutch Cable", action: "transmits clutch lever effort to the clutch release mechanism for smooth, predictable engagement" } },
  { re: /^throttle/i, info: { label: "Throttle Cable", action: "transmits throttle grip movement to the carburetor or throttle body for a precise, consistent acceleration response" } },
];

const FALLBACK_TYPE: TypeInfo = { label: "Control Cable", action: "transmits precise mechanical control input to the connected component" };

function parseItem(raw: string, group: string): ParsedItem {
  for (const { re, info } of TYPE_RULES) {
    if (re.test(raw)) {
      let rest = raw.replace(re, "").trim();
      rest = rest.replace(/^cable\b/i, "").trim();
      rest = rest.replace(/^[-–]\s*/, "").trim();
      const vehicles = rest.length > 0
        ? rest.split("/").map((s) => s.trim()).filter(Boolean)
        : group.split("/").map((s) => s.trim()).filter(Boolean);
      return { type: info, vehicles };
    }
  }
  return { type: FALLBACK_TYPE, vehicles: group.split("/").map((s) => s.trim()).filter(Boolean) };
}

/**
 * Rounds a price up to the nearest odd whole rupee (charm-pricing
 * convention for this catalog): 34.5→35, 31.7→33, 42.2→43, 47.5→49.
 * Never decreases the price; an already-odd whole number is left as-is.
 */
function roundUpToOddWhole(value: number): number {
  const ceiled = Math.ceil(value);
  return ceiled % 2 === 0 ? ceiled + 1 : ceiled;
}

function buildDescription(typeLabel: string, action: string, vehicles: string[]): string {
  const vehicleText = vehicles.length > 0 ? vehicles.join(", ") : "a wide range of two-wheeler models";
  return (
    `MOTOXPLUS ${typeLabel} is a friction-free, OEM-compatible replacement engineered for ${vehicleText}. ` +
    `Built with a galvanized steel inner wire running through a PVC-coated, low-friction outer casing, it ${action}. ` +
    `Precision-crimped brass and zinc-plated ferrules and nipples match factory dimensions for direct bolt-on fitment without modification. ` +
    `Each cable is tested for consistent free play, smooth operation, and long service life under regular riding conditions. Made in India.`
  );
}

async function main(): Promise<void> {
  const startTime = Date.now();
  const totalItems = CABLE_SECTIONS.reduce((sum, section) => sum + section.items.length, 0);

  console.log("Creating category...");
  const category = await withRetry("category upsert", () =>
    prisma.category.upsert({
      where: { slug: CATEGORY_SLUG },
      update: {},
      create: {
        name: "Cables",
        slug: CATEGORY_SLUG,
        sortOrder: 16,
        description:
          "Friction-free control cables — clutch, throttle, front brake, rear brake, speedometer, choke, seat lock, and gear cables — for motorcycles and scooters across Hero, Honda, Bajaj, TVS, Yamaha, Suzuki, Royal Enfield, and other major brands.",
      },
    })
  );
  console.log("Category ready.");

  console.log(`\nImporting ${totalItems} products...\n`);

  let counter = 0;
  let created = 0;
  let updated = 0;
  let failed = 0;
  const failures: FailedItem[] = [];

  for (const section of CABLE_SECTIONS) {
    for (const item of section.items) {
      counter += 1;
      const sku = `${SKU_PREFIX}${counter.toString().padStart(4, "0")}`;
      const { type, vehicles } = parseItem(item.name, section.group);
      const displayVehicles = vehicles.length > 0 ? vehicles.join(" / ") : section.group;
      const name = `MOTOXPLUS ${type.label} — ${displayVehicles}`;
      const description = buildDescription(type.label, type.action, vehicles);

      const price = roundUpToOddWhole(item.price);
      const mrp = parseFloat(item.mrp.toFixed(2));

      // Each product is handled independently: a permanent failure on one
      // SKU (after retries are exhausted) is recorded and the import moves
      // on, rather than aborting the remaining ~696 - counter products.
      try {
        const result = await withRetry(sku, () =>
          prisma.product.upsert({
            where: { sku },
            create: {
              name,
              sku,
              partNumber: sku,
              description,
              categoryId: category.id,
              price,
              mrp,
              gstRate: 18,
              hsnCode: "87141090",
              moq: 50,
              stock: 1000,
              brand: "MOTOXPLUS",
              warranty: "No Warranty",
              countryOfOrigin: "India",
              compatibility: vehicles,
              isActive: true,
            },
            update: {
              name,
              description,
              price,
              mrp,
              moq: 50,
              stock: 1000,
              compatibility: vehicles,
              isActive: true,
            },
          })
        );

        if (result.createdAt.getTime() === result.updatedAt.getTime()) {
          created += 1;
        } else {
          updated += 1;
        }
      } catch (err) {
        failed += 1;
        const message = err instanceof Error ? err.message : String(err);
        failures.push({ sku, name, error: message });
        console.error(`  ✗ ${sku} failed permanently: ${message}`);
      }

      if (counter % 100 === 0 || counter === totalItems) {
        console.log(`  [${counter}/${totalItems}]`);
      }
    }
  }

  const durationSec = (Date.now() - startTime) / 1000;
  const successRate = ((totalItems - failed) / totalItems) * 100;

  console.log("\n=== Import Summary ===");
  console.log(`Created:        ${created}`);
  console.log(`Updated:        ${updated}`);
  console.log(`Failed:         ${failed}`);
  console.log(`Duration:       ${durationSec.toFixed(1)}s`);
  console.log(`Total products: ${totalItems}`);
  console.log(`Success rate:   ${successRate.toFixed(1)}%`);
  console.log(`SKU range:      ${SKU_PREFIX}0001 → ${SKU_PREFIX}${totalItems.toString().padStart(4, "0")}`);

  if (failed > 0) {
    console.log("\nFailed SKUs:");
    for (const f of failures) console.log(`  ${f.sku} (${f.name}): ${f.error}`);
    // Signal failure to the shell without skipping the disconnect below.
    process.exitCode = 1;
  }
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
