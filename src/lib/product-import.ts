import * as XLSX from "xlsx";
import { prisma } from "@/lib/prisma";

const VALID_GST = [0, 5, 12, 18, 28];
const VALID_WARRANTY = ["No Warranty", "3 Months", "6 Months", "12 Months"];

const CATEGORY_HSN: Record<string, string> = {
  "brake parts":        "87149400",
  "engine parts":       "84099900",
  "suspension parts":   "87141090",
  "electrical parts":   "85122000",
  "transmission parts": "87141090",
  "body parts":         "87141090",
};

export interface FailedRow {
  rowNumber: number;
  sku: string;
  productName: string;
  error: string;
}

export interface ImportReport {
  totalRows: number;
  created: number;
  updated: number;
  failed: number;
  failedRows: FailedRow[];
}

interface ValidatedRow {
  rowNum: number;
  sku: string;
  productName: string;
  partNumber: string;
  imageUrls: string[];
  data: {
    name: string;
    sku: string;
    partNumber: string;
    description?: string;
    categoryId: string;
    price: number;
    mrp: number;
    gstRate: number;
    hsnCode: string;
    moq: number;
    stock: number;
    brand: string;
    warranty: string;
    countryOfOrigin: string;
    compatibility: string[];
  };
}

function str(row: Record<string, unknown>, key: string): string {
  const v = row[key];
  if (v == null) return "";
  return String(v).trim();
}

function toNum(row: Record<string, unknown>, ...keys: string[]): number | null {
  for (const k of keys) {
    const v = row[k];
    if (v != null && v !== "") {
      const n = parseFloat(String(v));
      if (!isNaN(n)) return n;
    }
  }
  return null;
}

function toInt(row: Record<string, unknown>, ...keys: string[]): number | null {
  for (const k of keys) {
    const v = row[k];
    if (v != null && v !== "") {
      const n = parseInt(String(v));
      if (!isNaN(n)) return n;
    }
  }
  return null;
}

export async function processImport(buffer: ArrayBuffer): Promise<ImportReport> {
  // ── Phase 1: Parse Excel (synchronous, no DB) ──────────────────────────
  const wb = XLSX.read(Buffer.from(buffer), { type: "buffer" });
  const ws = wb.Sheets[wb.SheetNames[0]];
  const rows = XLSX.utils.sheet_to_json<Record<string, unknown>>(ws, { defval: "" });

  const report: ImportReport = {
    totalRows: rows.length,
    created: 0,
    updated: 0,
    failed: 0,
    failedRows: [],
  };

  if (rows.length === 0) return report;

  // ── Phase 2: One DB call — fetch categories ────────────────────────────
  const categories = await prisma.category.findMany({ where: { isActive: true } });
  const catMap = new Map(categories.map((c) => [c.name.toLowerCase().trim(), c.id]));

  // ── Phase 3: Validate all rows (no further DB calls) ───────────────────
  const validRows: ValidatedRow[] = [];

  for (let i = 0; i < rows.length; i++) {
    const row = rows[i];
    const rowNum = i + 2;
    const sku = str(row, "SKU");
    const productName = str(row, "Product Name");
    const errors: string[] = [];

    if (!productName) errors.push("Product Name required");
    if (!sku) errors.push("SKU required");

    const catName = str(row, "Category");
    const categoryId = catMap.get(catName.toLowerCase());
    if (!catName) errors.push("Category required");
    else if (!categoryId) errors.push(`Category "${catName}" not found`);

    const partNumber = str(row, "Part Number");
    if (!partNumber) errors.push("Part Number required");

    const mrp = toNum(row, "MRP");
    if (mrp === null || mrp < 0) errors.push("MRP required and must be >= 0");

    // Wholesale price is always 70% off MRP (auto-calculated)
    const price = mrp !== null ? parseFloat((mrp * 0.30).toFixed(2)) : null;

    const gstRate = toNum(row, "GST Rate");
    if (gstRate === null) errors.push("GST Rate required");
    else if (!VALID_GST.includes(gstRate)) errors.push("GST Rate must be one of: 0, 5, 12, 18, 28");

    const hsnCode = CATEGORY_HSN[catName.toLowerCase()] ?? str(row, "HSN Code");
    if (!hsnCode) errors.push("HSN Code required — category not recognized for auto-fill");
    else if (!/^\d{8}$/.test(hsnCode)) errors.push("HSN Code must be exactly 8 digits");

    const moq = toInt(row, "MOQ") ?? 10;
    if (moq <= 0) errors.push("MOQ must be > 0");

    const stock = toInt(row, "Stock", "Stock Quantity") ?? 0;
    if (stock < 0) errors.push("Stock must be >= 0");

    if (errors.length > 0) {
      report.failed++;
      report.failedRows.push({ rowNumber: rowNum, sku, productName, error: errors.join("; ") });
      continue;
    }

    const warrantyRaw = str(row, "Warranty");
    const compatRaw = str(row, "Compatible Vehicles");
    const imgRaw = str(row, "Image URLs");

    validRows.push({
      rowNum,
      sku,
      productName,
      partNumber,
      imageUrls: imgRaw ? imgRaw.split(",").map((s) => s.trim()).filter(Boolean) : [],
      data: {
        name: productName,
        sku,
        partNumber,
        description: str(row, "Description") || undefined,
        categoryId: categoryId!,
        price: price!,
        mrp: mrp!,
        gstRate: gstRate!,
        hsnCode,
        moq,
        stock,
        brand: str(row, "Brand") || "MOTOXPLUS",
        warranty: VALID_WARRANTY.includes(warrantyRaw) ? warrantyRaw : "No Warranty",
        countryOfOrigin: str(row, "Country of Origin") || "India",
        compatibility: compatRaw ? compatRaw.split(",").map((s) => s.trim()).filter(Boolean) : [],
      },
    });
  }

  if (validRows.length === 0) return report;

  // ── Phase 3b: Detect duplicates within the batch itself ───────────────
  const batchSkuSeen = new Map<string, number>();
  const batchPartSeen = new Map<string, number>();
  const dedupedRows: ValidatedRow[] = [];
  for (const row of validRows) {
    const skuConflict = batchSkuSeen.get(row.sku);
    const partConflict = batchPartSeen.get(row.partNumber);
    if (skuConflict !== undefined) {
      report.failed++;
      report.failedRows.push({
        rowNumber: row.rowNum,
        sku: row.sku,
        productName: row.productName,
        error: `Duplicate SKU in this file: "${row.sku}" first appeared on row ${skuConflict}`,
      });
    } else if (partConflict !== undefined) {
      report.failed++;
      report.failedRows.push({
        rowNumber: row.rowNum,
        sku: row.sku,
        productName: row.productName,
        error: `Duplicate Part Number in this file: "${row.partNumber}" first appeared on row ${partConflict}`,
      });
    } else {
      batchSkuSeen.set(row.sku, row.rowNum);
      batchPartSeen.set(row.partNumber, row.rowNum);
      dedupedRows.push(row);
    }
  }

  if (dedupedRows.length === 0) return report;

  // ── Phase 4: One DB call — fetch all existing SKUs at once ────────────
  const allSkus = dedupedRows.map((r) => r.sku);
  const existingProducts = await prisma.product.findMany({
    where: { sku: { in: allSkus } },
    select: { id: true, sku: true },
  });
  const existingMap = new Map(existingProducts.map((p) => [p.sku, p.id]));

  // ── Phase 5: Process creates and updates sequentially ─────────────────
  for (const row of dedupedRows) {
    try {
      const existingId = existingMap.get(row.sku);

      if (existingId) {
        await prisma.product.update({ where: { sku: row.sku }, data: row.data });
        if (row.imageUrls.length > 0) {
          await prisma.productImage.deleteMany({ where: { productId: existingId } });
          await prisma.productImage.createMany({
            data: row.imageUrls.map((url, idx) => ({
              productId: existingId,
              imageUrl: url,
              isPrimary: idx === 0,
              sortOrder: idx,
            })),
          });
        }
        report.updated++;
      } else {
        const created = await prisma.product.create({ data: row.data });
        if (row.imageUrls.length > 0) {
          await prisma.productImage.createMany({
            data: row.imageUrls.map((url, idx) => ({
              productId: created.id,
              imageUrl: url,
              isPrimary: idx === 0,
              sortOrder: idx,
            })),
          });
        }
        report.created++;
      }
    } catch (err: unknown) {
      report.failed++;
      let msg = err instanceof Error ? err.message : "Unknown error";
      if (msg.includes("Unique constraint") || msg.includes("P2002")) {
        if (msg.toLowerCase().includes("partnumber") || msg.toLowerCase().includes("part_number")) {
          msg = `Duplicate Part Number: "${row.partNumber}" is already used by another product`;
        } else if (msg.toLowerCase().includes("sku")) {
          msg = `Duplicate SKU: "${row.sku}" is already used by another product`;
        } else {
          msg = `Duplicate value: SKU "${row.sku}" or Part Number "${row.partNumber}" already exists`;
        }
      }
      report.failedRows.push({
        rowNumber: row.rowNum,
        sku: row.sku,
        productName: row.productName,
        error: msg,
      });
    }
  }

  return report;
}

export function generateTemplate(): Buffer {
  const headers = [
    "Product Name",
    "Category",
    "SKU",
    "Part Number",
    "Description",
    "MRP",
    "GST Rate",
    "HSN Code",
    "MOQ",
    "Stock",
    "Brand",
    "Warranty",
    "Country of Origin",
    "Compatible Vehicles",
    "Image URLs",
  ];

  const sample = [
    "Front Brake Pad Set",
    "Brake Parts",
    "BRK-FP-001",
    "BRK-FP-001-PN",
    "High-performance front brake pad set for Honda Activa",
    "850",
    "18",
    "87149400",
    "10",
    "100",
    "MOTOXPLUS",
    "6 Months",
    "India",
    "Honda Activa, TVS Jupiter, Hero Splendor",
    "https://example.com/img1.jpg",
  ];

  const wb = XLSX.utils.book_new();
  const ws = XLSX.utils.aoa_to_sheet([headers, sample]);
  ws["!cols"] = headers.map((h) => ({ wch: Math.max(h.length + 4, 22) }));
  XLSX.utils.book_append_sheet(wb, ws, "Products");

  return XLSX.write(wb, { type: "buffer", bookType: "xlsx" }) as Buffer;
}
