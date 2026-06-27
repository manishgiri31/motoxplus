/**
 * Creates ONE "FRONT MUDGUARD" master product with 139 variants.
 * Each variant gets vehicleModel + extra (color) so the Amazon-style
 * two-step selector (model → color) works on the product detail page.
 * Run: npm run db:seed-mudguard
 */

import * as XLSX from "xlsx";
import { PrismaClient } from "@prisma/client";
import path from "path";

const prisma = new PrismaClient();

interface ExcelRow {
  "Product Name": string;
  SKU: string;
  "Part Number": string;
  MRP: number;
  "GST Rate": number;
  "HSN Code": number | string;
  MOQ: number;
  Stock: number;
  Brand: string;
  Warranty: string;
  "Country of Origin": string;
  "Compatible Vehicles": string;
}

const MASTER_SKU = "MX-MUDGUARD";
const MASTER_NAME = "FRONT MUDGUARD";

// Order matters — longer/more-specific prefixes must come first so they match before shorter ones.
const MODEL_PREFIXES = [
  "SPLENDOR I-SMART",
  "SUPER SPLENDOR LATEST",
  "SUPER SPLENDOR",
  "SPLENDOR",
  "PASSION PLUS/PASSION",
  "XPRO PASSION",
  "PASSION PRO",
  "PASSION PLUS",
  "PASSION",
  "GLAMOUR LATEST",
  "GLAMOUR",
  "CBZ STAR/AMBITION",
  "CBZ XTREME N/M",
  "CBZ XTREME",
  "CBZ",
  "KARIZMA",
  "CD DLX/SPLD. NXG",
  "HERO HONDA HUNK",
  "HUNK N/M",
  "MAESTRO",
  "CB UNICORN N/M",
  "UNICORN",
  "CB SHINE N/M",
  "SHINE",
];

/**
 * Splits a variant label like "SPLENDOR BLACK" into
 * { vehicleModel: "SPLENDOR", extra: "BLACK" }
 */
function parseModelColor(label: string): { vehicleModel: string; extra: string } {
  for (const model of MODEL_PREFIXES) {
    if (label.startsWith(model + " ") || label === model) {
      return {
        vehicleModel: model,
        extra: label.slice(model.length).trim() || label,
      };
    }
  }
  return { vehicleModel: "OTHER", extra: label };
}

async function fixMadguardTypo() {
  const bad = await prisma.product.findMany({
    where: { name: { contains: "MADGUARD" } },
    select: { id: true, name: true },
  });
  if (bad.length === 0) return;
  console.log(`Fixing ${bad.length} MADGUARD typo(s)…`);
  for (const p of bad) {
    await prisma.product.update({
      where: { id: p.id },
      data: { name: p.name.split("MADGUARD").join("MUDGUARD") },
    });
  }
  console.log("✓ Fixed MADGUARD → MUDGUARD\n");
}

async function removeOldMasterProducts() {
  const old = await prisma.product.findMany({
    where: { sku: { endsWith: "-MG" }, name: { startsWith: "FRONT MUDGUARD" } },
    select: { id: true, sku: true },
  });
  const toDelete = old.filter((p) => p.sku !== MASTER_SKU);
  if (toDelete.length === 0) return;
  console.log(`Removing ${toDelete.length} old per-model master product(s)…`);
  for (const p of toDelete) {
    await prisma.product.delete({ where: { id: p.id } });
  }
  console.log("✓ Old masters removed\n");
}

async function deactivateIndividualMudguards() {
  const result = await prisma.product.updateMany({
    where: {
      name: { contains: "MUDGUARD" },
      sku: { not: MASTER_SKU },
      isActive: true,
    },
    data: { isActive: false },
  });
  if (result.count > 0) {
    console.log(`✓ Deactivated ${result.count} individual mudguard product(s)\n`);
  }
}

async function main() {
  await fixMadguardTypo();
  await removeOldMasterProducts();
  await deactivateIndividualMudguards();

  const category = await prisma.category.findFirst({ where: { slug: "body-parts" } });
  if (!category) throw new Error('"body-parts" category not found. Run `npx prisma db seed` first.');

  const xlsxPath = path.join(process.cwd(), "public", "mudguard-nose-tail-panel-import.xlsx");
  const wb = XLSX.readFile(xlsxPath);
  const ws = wb.Sheets[wb.SheetNames[0]];
  const rows = XLSX.utils.sheet_to_json<ExcelRow>(ws, { defval: "" });
  console.log(`Read ${rows.length} rows from Excel`);

  const minMrp = Math.min(...rows.map((r) => Number(r.MRP)));
  const masterPrice = parseFloat((minMrp * 0.3).toFixed(2));

  const allCompat = Array.from(
    new Set(
      rows.flatMap((r) =>
        String(r["Compatible Vehicles"])
          .split(",")
          .map((s) => s.trim())
          .filter(Boolean)
      )
    )
  );

  const first = rows[0];

  const master = await (prisma.product as any).upsert({
    where: { sku: MASTER_SKU },
    create: {
      name: MASTER_NAME,
      sku: MASTER_SKU,
      partNumber: MASTER_SKU,
      description: "MOTOXPLUS Front Mudguard is an OEM-compatible replacement body part precision-engineered for Hero and Honda motorcycles. Manufactured from high-impact ABS plastic with UV-resistant, colour-stable pigments for superior durability and long-lasting finish. Designed to match original OEM contours for a perfect bolt-on installation with no drilling or modifications required. Each mudguard undergoes multi-point dimensional inspection to ensure exact fitment with original mounting brackets. Available across all major models — Splendor, Passion Plus, Glamour, CBZ, Unicorn, CB Shine, Maestro — in a complete range of factory-matched colours. ISO-quality assured. Made in India.",
      categoryId: category.id,
      price: masterPrice,
      mrp: minMrp,
      gstRate: Number(first["GST Rate"]),
      hsnCode: String(first["HSN Code"]),
      moq: Number(first.MOQ),
      stock: 0,
      brand: "MOTOXPLUS",
      warranty: String(first.Warranty),
      countryOfOrigin: String(first["Country of Origin"]),
      compatibility: allCompat,
      isActive: true,
    },
    update: {
      name: MASTER_NAME,
      isActive: true,
      compatibility: allCompat,
    },
  });

  await prisma.productVariant.deleteMany({ where: { productId: master.id } });

  const variants = rows.map((r, i) => {
    // Strip "FRONT MUDGUARD " prefix to get "SPLENDOR BLACK", then split into model+color
    const shortLabel = String(r["Product Name"]).replace("FRONT MUDGUARD ", "").trim();
    const { vehicleModel, extra } = parseModelColor(shortLabel);
    return {
      productId: master.id,
      label: shortLabel,
      sku: r.SKU,
      partNumber: String(r["Part Number"] || r.SKU),
      vehicleModel,
      extra,
      price: parseFloat((Number(r.MRP) * 0.3).toFixed(2)),
      mrp: Number(r.MRP),
      stock: Number(r.Stock),
      moq: Number(r.MOQ),
      sortOrder: i,
      isActive: true,
    };
  });

  await prisma.productVariant.createMany({ data: variants });

  // Show the model breakdown
  const modelCounts: Record<string, number> = {};
  variants.forEach((v) => { modelCounts[v.vehicleModel] = (modelCounts[v.vehicleModel] ?? 0) + 1; });
  Object.entries(modelCounts).forEach(([m, n]) => console.log(`  ${m}: ${n} color(s)`));

  console.log(`\n✓ "${MASTER_NAME}" — ${variants.length} variants across ${Object.keys(modelCounts).length} models.\n`);
}

main()
  .catch((err) => { console.error(err); process.exit(1); })
  .finally(() => prisma.$disconnect());
