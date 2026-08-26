import { PrismaClient } from "@prisma/client";

const url = process.env.PROD_DATABASE_URL;
if (!url) {
  console.error("Set PROD_DATABASE_URL before running this script.");
  process.exit(1);
}

const prisma = new PrismaClient({ datasources: { db: { url } } });

async function main() {
  const orderStatusEnum = await prisma.$queryRawUnsafe(
    `SELECT unnest(enum_range(NULL::"OrderStatus"))::text AS value;`
  );
  const paymentStatusEnum = await prisma.$queryRawUnsafe(
    `SELECT unnest(enum_range(NULL::"PaymentStatus"))::text AS value;`
  );
  console.log("\n=== OrderStatus enum values ===");
  console.log(orderStatusEnum);
  console.log("\n=== PaymentStatus enum values ===");
  console.log(paymentStatusEnum);

  const manifested = await prisma.$queryRawUnsafe(`
    SELECT id, "orderId", waybill, "createdAt" FROM "Shipment"
    WHERE waybill IS NOT NULL AND waybill != ''
      AND "createdAt" < '2026-08-24' ORDER BY "createdAt";
  `);
  console.log("\n=== Task 1 query: manifested shipments (waybill set, createdAt < 2026-08-24) ===");
  console.log(manifested);
  console.log(`Row count: ${(manifested as unknown[]).length}`);

  const totalShipments = await prisma.$queryRawUnsafe(`SELECT COUNT(*)::int AS count FROM "Shipment";`);
  console.log("\n=== Total Shipment rows ===");
  console.log(totalShipments);

  const emptyWaybill = await prisma.$queryRawUnsafe(
    `SELECT COUNT(*)::int AS count FROM "Shipment" WHERE waybill IS NULL OR waybill = '';`
  );
  console.log("\n=== Shipment rows with empty/null waybill ===");
  console.log(emptyWaybill);

  const paidOrConfirmed = await prisma.$queryRawUnsafe(`
    SELECT COUNT(*)::int AS count FROM "Order"
    WHERE ("paymentStatus" = 'PAID' OR status = 'CONFIRMED')
      AND "createdAt" >= '2026-06-20';
  `);
  console.log("\n=== Orders with paymentStatus=PAID OR status=CONFIRMED, created since 2026-06-20 ===");
  console.log(paidOrConfirmed);

  // Breakdown for context, since "PAID or CONFIRMED" collapses two different enums into one number.
  const breakdown = await prisma.$queryRawUnsafe(`
    SELECT status, "paymentStatus", COUNT(*)::int AS count
    FROM "Order"
    WHERE "createdAt" >= '2026-06-20'
    GROUP BY status, "paymentStatus"
    ORDER BY count DESC;
  `);
  console.log("\n=== Order status/paymentStatus breakdown since 2026-06-20 ===");
  console.log(breakdown);

  const range = await prisma.$queryRawUnsafe(
    `SELECT MIN("createdAt") AS earliest, MAX("createdAt") AS latest FROM "Shipment";`
  );
  console.log("\n=== Shipment createdAt range ===");
  console.log(range);

  const totalOrders = await prisma.$queryRawUnsafe(`SELECT COUNT(*)::int AS count FROM "Order";`);
  console.log("\n=== Total Order rows (sanity check) ===");
  console.log(totalOrders);
}

main()
  .catch((err) => {
    console.error("FAILED:", err);
    process.exitCode = 1;
  })
  .finally(() => prisma.$disconnect());
