import { PrismaClient } from "@prisma/client";

const prisma = new PrismaClient();

/**
 * Creates (or updates) a single ₹1 dummy product for end-to-end testing
 * of cart / checkout / payment flows without spending real money.
 *
 * Run:  node scripts/add-test-product.mjs
 * Undo: node scripts/add-test-product.mjs --delete
 */

const SKU = "TEST-XYZ-001";
const del = process.argv.includes("--delete");

if (del) {
  const r = await prisma.product.deleteMany({ where: { sku: SKU } });
  console.log(`Deleted ${r.count} test product(s) (sku=${SKU}).`);
  await prisma.$disconnect();
  process.exit(0);
}

const category = await prisma.category.findFirst({ orderBy: { sortOrder: "asc" } });
if (!category) {
  throw new Error("No categories exist — cannot attach the test product.");
}

const data = {
  name: "xyz",
  slug: "xyz-test-product",
  sku: SKU,
  partNumber: SKU,
  description: "Internal ₹1 test product. Not for sale — used to verify cart, checkout and payment flows.",
  categoryId: category.id,
  price: 1,
  mrp: 1,
  gstRate: 0,
  hsnCode: "00000000",
  moq: 1,
  stock: 999,
  brand: "MOTOXPLUS",
  warranty: "No Warranty",
  countryOfOrigin: "India",
  compatibility: [],
  isActive: true,
};

const product = await prisma.product.upsert({
  where: { sku: SKU },
  create: data,
  update: { name: data.name, price: data.price, mrp: data.mrp, stock: data.stock, isActive: true },
});

console.log(`Test product ready: "${product.name}" — ₹${product.price} — sku=${product.sku} — slug=${product.slug}`);
console.log(`Category: ${category.name}`);
await prisma.$disconnect();
