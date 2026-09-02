import { PrismaClient } from "@prisma/client";
// Read-only audit queries (Step 3). Point AUDIT_DB_URL at the restored scratch DB:
//   AUDIT_DB_URL="postgresql://audit_ro:***@localhost:5432/motoxplus_audit" node .scratch/audit/step3.mjs
const url = process.env.AUDIT_DB_URL;
if (!url) { console.error("set AUDIT_DB_URL to the scratch (read-only) DB connection string"); process.exit(1); }
const prisma = new PrismaClient({ datasources: { db: { url } }, log: ["error"] });
const q = (label, sql) =>
  prisma.$queryRawUnsafe(sql).then(
    (r) => { console.log(`\n########## ${label} ##########`); console.dir(r, { depth: 6, maxArrayLength: 500 }); },
    (e) => { console.log(`\n########## ${label} :: ERROR ##########`); console.log(String(e.message || e).slice(0, 1200)); }
  );

await q("0. connectivity", `select current_database() db, current_user usr`);

await q("0b. counts", `select
  (select count(*) from "Order") orders,
  (select count(*) from "Shipment") shipments,
  (select count(*) from "Payment") payments,
  (select count(*) from "Invoice") invoices,
  (select count(*) from "OrderItem") order_items,
  (select count(*) from "OrderCancellation") cancellations,
  (select count(*) from "OrderEvent") order_events,
  (select count(*) from "UserSession") sessions,
  (select count(*) from "User") users, (select count(*) from "Dealer") dealers,
  (select count(*) from "PaymentSubmission") pay_submissions,
  (select count(*) from "ShipmentTrackingEvent") tracking_events`);

await q("0c. Order.status x paymentType x paymentStatus breakdown", `
  select status, "paymentType", "paymentStatus", count(*) n,
         sum("amountPaid")::float paid, sum("grandTotal")::float gtotal
  from "Order" group by 1,2,3 order by 1,2,3`);

await q("0d. Payment.status x paymentType breakdown", `
  select status, "paymentType", count(*) n, sum(amount)::float amt,
         count("razorpayPaymentId") with_rzp_pay_id, count("razorpayOrderId") with_rzp_order_id
  from "Payment" group by 1,2 order by 1,2`);

/* ---------- ITEM 1: F-05 occurrences ---------- */
await q("1. F-05 — PAID payments whose order never completed (PENDING / no invoice / no items)", `
  select p.id payment_id, p."razorpayPaymentId" rzp_payment_id, p."razorpayOrderId" rzp_order_id,
         p.amount::float amount, p."paymentType" ptype, p.status pay_status, p."createdAt" paid_at,
         o."orderNumber", o.status order_status, o."paymentStatus" order_pay_status,
         o."amountPaid"::float order_amount_paid, o."stockReserved",
         d."companyName" dealer, u.email dealer_email, u."mobileNumber" dealer_mobile,
         (select count(*) from "OrderItem" oi where oi."orderId"=o.id) item_rows,
         (select count(*) from "Invoice" i where i."orderId"=o.id) invoice_rows,
         (select count(*) from "OrderCancellation" c where c."orderId"=o.id) cxl_rows,
         (select c."refundStatus" from "OrderCancellation" c where c."orderId"=o.id) refund_status,
         (select c."refundId" from "OrderCancellation" c where c."orderId"=o.id) refund_id
  from "Payment" p
  join "Order" o on o.id = p."orderId"
  left join "Dealer" d on d.id = o."dealerId"
  left join "User" u on u.id = d."userId"
  where p.status = 'PAID'
    and ( o.status = 'PENDING'
       or not exists (select 1 from "Invoice" i where i."orderId"=o.id)
       or not exists (select 1 from "OrderItem" oi where oi."orderId"=o.id) )
  order by p."createdAt"`);

await q("1b. ALL PAID payments (context for item 1)", `
  select p.id payment_id, p."razorpayPaymentId" rzp_pay, p.amount::float amt, p."paymentType" ptype,
         p."createdAt" paid_at, o."orderNumber", o.status ostatus, o."paymentStatus" opaystatus,
         o."amountPaid"::float oamtpaid,
         (select count(*) from "Invoice" i where i."orderId"=o.id) inv,
         (select count(*) from "OrderItem" oi where oi."orderId"=o.id) items
  from "Payment" p join "Order" o on o.id=p."orderId"
  where p.status='PAID' order by p."createdAt"`);

await q("1c. orders PENDING/PARTIAL with money recorded as paid but not confirmed", `
  select o."orderNumber", o.status, o."paymentStatus", o."paymentType",
         o."amountPaid"::float amount_paid, o."amountDue"::float amount_due, o."grandTotal"::float gt,
         o."stockReserved", o."createdAt",
         (select count(*) from "Payment" p where p."orderId"=o.id) pay_rows,
         (select string_agg(p.status||':'||p.amount::text, ', ') from "Payment" p where p."orderId"=o.id) pays
  from "Order" o
  where (o."amountPaid" > 0 or o."paymentStatus" in ('PAID','PARTIAL'))
    and o.status in ('PENDING','CONFIRMED')
  order by o."createdAt"`);

/* ---------- ITEM 2: zero shipments / F-21 ---------- */
await q("2. shipment table + orders that SHOULD have an AWB (COD any status, or prepaid confirmed+)", `
  select o."orderNumber", o."paymentType", o.status, o."paymentStatus", o."deliveryPincode",
         o."deliveryCity", o."deliveryState", o."createdAt",
         exists(select 1 from "Shipment" s where s."orderId"=o.id) has_shipment
  from "Order" o
  where (o."paymentType"='COD' and o.status <> 'CANCELLED')
     or (o."paymentType" <> 'COD' and o.status in ('CONFIRMED','PROCESSING','SHIPPED','DELIVERED'))
  order by o."createdAt"`);

await q("2b. OrderEvent types present (any shipment/AWB failure trail?)", `
  select type, count(*) n, min("createdAt") first, max("createdAt") last
  from "OrderEvent" group by 1 order by 2 desc`);

await q("2c. any OrderEvent mentioning delhivery/shipment/awb/waybill in reason", `
  select o."orderNumber", e.type, e.reason, e."createdAt"
  from "OrderEvent" e join "Order" o on o.id=e."orderId"
  where lower(coalesce(e.reason,'')) ~ '(delhiv|shipment|awb|waybill|manifest|pickup|courier)'
  order by e."createdAt"`);

await q("2d. Setting keys (delhivery / pickup config, feature flags)", `
  select key, left(value, 200) value_head, "updatedAt" from "Setting" order by key`);

await q("2e. distinct delivery pincodes on orders (serviceability sanity)", `
  select o."deliveryPincode", count(*) n, string_agg(distinct o.status::text, ',') statuses
  from "Order" o group by 1 order by 2 desc`);

/* ---------- ITEM 3: under-charge / over-charge sets ---------- */
await q("3. CancellationPolicy singleton", `select * from "CancellationPolicy"`);

await q("3a. ALL OrderCancellation rows (full context — dataset is tiny)", `
  select c."orderId", o."orderNumber", o."paymentType", c."fromStatus", c."feePercent"::float feepct,
         c."feeAmount"::float feeamt, c."amountPaidAtCancellation"::float paid_at_cxl,
         c."refundAmount"::float refundamt, c."refundStatus", c."refundId", c."refundedAt",
         c."cancelledByRole", c."waived", c."createdAt",
         o.status cur_order_status,
         (select s.status::text from "Shipment" s where s."orderId"=c."orderId") shipment_status,
         (select s.waybill from "Shipment" s where s."orderId"=c."orderId") waybill
  from "OrderCancellation" c join "Order" o on o.id = c."orderId"
  order by c."createdAt"`);

await q("3b. UNDER-charge set: cancelled at pre-ship % but a shipment exists / existed not-cancelled", `
  select o."orderNumber", c."feePercent"::float feepct, c."refundAmount"::float refundamt,
         c."amountPaidAtCancellation"::float paid, s.status::text shipment_status, s.waybill, s."createdAt" awb_created
  from "OrderCancellation" c
  join "Order" o on o.id=c."orderId"
  join "Shipment" s on s."orderId"=c."orderId"
  where c."feePercent" <= (select "preShipChargePercent" from "CancellationPolicy" limit 1)
    and s.status <> 'CANCELLED'`);

await q("3c. OVER-charge set: cancelled at post-ship % but shipment never left pickup (still MANIFESTED/PENDING or none)", `
  select o."orderNumber", c."feePercent"::float feepct, c."feeAmount"::float feeamt,
         c."amountPaidAtCancellation"::float paid,
         coalesce((select s.status::text from "Shipment" s where s."orderId"=c."orderId"),'<no shipment>') shipment_status
  from "OrderCancellation" c join "Order" o on o.id=c."orderId"
  where c."feePercent" >= (select "postShipChargePercent" from "CancellationPolicy" limit 1)
    and coalesce((select s.status::text from "Shipment" s where s."orderId"=c."orderId"),'NONE')
        in ('NONE','PENDING','MANIFESTED')`);

/* ---------- ITEM 4: currently-exploitable orders ---------- */
await q("4. currently-exploitable: live parcel (shipment past pickup OR order really shipped) but order.status reads PRE_SHIP", `
  select o."orderNumber", o.status order_status, o."paymentType", o."amountPaid"::float paid,
         s.status::text shipment_status, s.waybill, s."createdAt" awb_at, s."updatedAt" awb_upd,
         round(extract(epoch from (now() - s."createdAt"))/86400.0, 1) awb_age_days
  from "Order" o join "Shipment" s on s."orderId"=o.id
  where o.status in ('PENDING','CONFIRMED','PROCESSING')
    and (s.status <> 'MANIFESTED' or s."createdAt" < now() - interval '3 days')`);

await q("4b. orders cancellable right now by a dealer at 2% while having ANY shipment", `
  select o."orderNumber", o.status, o."paymentType", o."amountPaid"::float paid, s.status::text sstatus
  from "Order" o join "Shipment" s on s."orderId"=o.id
  where o.status in ('PENDING','CONFIRMED','PROCESSING') and o."paymentType" <> 'COD' and o."amountPaid" > 0`);

/* ---------- ITEM 5: F-18 stale-session cohort ---------- */
await q("5. UserSession schema columns", `
  select column_name, data_type from information_schema.columns
  where table_name='UserSession' order by ordinal_position`);

await q("5a. UserSession age / active distribution", `
  select "isActive",
         count(*) n,
         count(*) filter (where "expiresAt" < now()) expired,
         count(*) filter (where "createdAt" < now() - interval '7 days') older_than_7d,
         count(*) filter (where "isActive" and "expiresAt" > now()) active_unexpired,
         count(*) filter (where "isActive" and "createdAt" < now() - interval '7 days') active_older_7d,
         min("createdAt") oldest, max("createdAt") newest
  from "UserSession" group by 1`);

await q("5b. F-18 cohort: active sessions created >7d ago (still usable on web per F-18b)", `
  select s.id, s."userId", u.email, u.role, s."createdAt", s."expiresAt", s."isActive",
         round(extract(epoch from (now() - s."createdAt"))/86400.0,1) age_days
  from "UserSession" s left join "User" u on u.id=s."userId"
  where s."isActive" = true and s."createdAt" < now() - interval '7 days'
  order by s."createdAt"`);

await q("5c. all UserSession rows (tiny dataset)", `
  select s.id, s."userId", u.email, u.role, s."isActive", s."createdAt", s."expiresAt",
         round(extract(epoch from (now()-s."createdAt"))/86400.0,1) age_days,
         (s."expiresAt" < now()) is_expired
  from "UserSession" s left join "User" u on u.id=s."userId" order by s."createdAt"`);

await prisma.$disconnect();
