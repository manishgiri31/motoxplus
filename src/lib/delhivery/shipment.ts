import { Prisma } from "@prisma/client";
import { delhiveryPost } from "./client";
import { getDelhiveryConfig } from "./config";
import { prisma } from "@/lib/prisma";
import { roundToPaise } from "@/lib/utils";
import type {
  DelhiveryCreateShipmentRequest,
  DelhiveryCreateShipmentResponse,
  DelhiveryPickupLocation,
  DelhiveryShipmentPayload,
} from "./types";

export interface BuildShipmentPayloadInput {
  destName: string;
  destAddress: string;
  destPincode: string;
  destCity: string;
  destState: string;
  destPhone: string;
  orderRef: string;
  paymentMode: "Prepaid" | "COD";
  codAmount: number;
  totalAmount: number;
  productsDesc: string;
  hsnCode: string;
  quantity: number;
  weightKg: number;
  addressType: "home" | "office";
  orderDate: string; // YYYY-MM-DD
}

/**
 * Pure payload builder — no DB, no network. Shared by createDelhiveryShipment
 * (real orders, below) and scripts/delhivery-capture.ts, so the capture
 * script actually exercises the same payload-construction code production
 * traffic goes through instead of a hand-rolled copy that can drift.
 */
export function buildShipmentPayload(input: BuildShipmentPayloadInput): DelhiveryShipmentPayload {
  const { pickup, companyGst } = getDelhiveryConfig();
  return {
    name: input.destName,
    add: input.destAddress,
    pin: input.destPincode,
    city: input.destCity,
    state: input.destState,
    country: "India",
    phone: input.destPhone,
    order: input.orderRef,
    payment_mode: input.paymentMode,
    return_pin: pickup.pincode,
    return_city: pickup.city,
    return_phone: pickup.phone,
    return_name: pickup.name,
    return_add: pickup.address,
    return_state: pickup.state,
    return_country: "India",
    products_desc: input.productsDesc,
    hsn_code: input.hsnCode,
    cod_amount: input.codAmount,
    order_date: input.orderDate,
    total_amount: input.totalAmount,
    seller_gst_tin: companyGst,
    shipping_mode: "Surface",
    address_type: input.addressType,
    quantity: input.quantity,
    weight: input.weightKg,
  };
}

/**
 * pickup_location is a SIBLING of `shipments` in the create.json request body
 * (confirmed missing entirely before the 2026-08-23 live capture — see
 * delhivery-reference.md). `name` is the immutable registered pickup location
 * on the Delhivery client, NOT the same value as return_name/PICKUP_NAME above.
 */
export function buildPickupLocation(): DelhiveryPickupLocation {
  const { pickup } = getDelhiveryConfig();
  return {
    name: pickup.locationName,
    add: pickup.address,
    city: pickup.city,
    pin_code: pickup.pincode,
    country: "India",
    phone: pickup.phone,
  };
}

export function buildCreateShipmentRequest(input: BuildShipmentPayloadInput): DelhiveryCreateShipmentRequest {
  return {
    shipments: [buildShipmentPayload(input)],
    pickup_location: buildPickupLocation(),
  };
}

const trackUrl = (waybill: string) => `https://www.delhivery.com/track/package/${waybill}`;

const SHIPMENT_ORDER_INCLUDE = {
  dealer: true,
  items: { include: { product: true } },
  shipment: true,
} satisfies Prisma.OrderInclude;

type ShipmentOrder = Prisma.OrderGetPayload<{ include: typeof SHIPMENT_ORDER_INCLUDE }>;

/**
 * Creates the Delhivery shipment for an order and moves it to PROCESSING.
 * Safe to call more than once for the same order and safe to call
 * concurrently — returns the existing AWB instead of minting a second one.
 *
 * Idempotency is enforced at the DATABASE, not in memory (delhivery-open-items
 * #2 / F-03). Two entry points can race for the same order: the auto trigger
 * on order confirmation (autoCreateShipment, from COD placement or prepaid
 * payment finalize — itself reachable twice via verify + webhook) and the
 * manual admin trigger (POST /api/admin/shipments). Without a cross-process
 * lock both callers pass the "does a Shipment row exist yet?" check and both
 * POST /api/cmu/create.json = two real AWBs; the Shipment.orderId unique
 * constraint would then only hide the second row, not the second parcel.
 *
 * Guard: a fast-path read outside any transaction (the common re-entrant
 * case), then a Postgres transaction-scoped advisory lock keyed on the order
 * for the create path. The lock auto-releases on commit/rollback; the unique
 * constraint stays as a last-resort backstop (the P2002 handler below).
 */
export async function createDelhiveryShipment(orderId: string): Promise<{
  waybill: string;
  trackingUrl: string;
}> {
  // Fast path: most calls are re-entrant (verify + webhook both finalize, a
  // Razorpay webhook retry, admin re-click). If the row already exists, return
  // it without opening a transaction or taking the lock.
  const preExisting = await prisma.shipment.findUnique({ where: { orderId } });
  if (preExisting) {
    return { waybill: preExisting.waybill, trackingUrl: preExisting.trackingUrl ?? trackUrl(preExisting.waybill) };
  }

  try {
    return await prisma.$transaction(
      async (tx) => {
        // Serialise every concurrent create for this order, across processes.
        // hashtext() -> int4, widened to the bigint pg_advisory_xact_lock
        // overload. The second caller blocks here, then the re-check below
        // sees the row the first caller wrote and returns its AWB.
        await tx.$queryRaw`SELECT pg_advisory_xact_lock(hashtext(${`delhivery:shipment:${orderId}`}))`;

        const order = await tx.order.findUnique({
          where: { id: orderId },
          include: SHIPMENT_ORDER_INCLUDE,
        });
        if (!order) throw new Error(`Order ${orderId} not found`);
        if (order.shipment) {
          return {
            waybill: order.shipment.waybill,
            trackingUrl: order.shipment.trackingUrl ?? trackUrl(order.shipment.waybill),
          };
        }
        if (order.status === "PENDING" || order.status === "CANCELLED") {
          throw new Error(`Order ${orderId} is ${order.status} — cannot create a shipment for it`);
        }

        return await createShipmentLocked(tx, order);
      },
      // The create.json round-trip (retries:1, 15s per-attempt AbortSignal)
      // runs inside this transaction while the lock is held, so the default
      // 5s interactive-transaction timeout is far too short.
      { timeout: 25_000, maxWait: 8_000 }
    );
  } catch (err) {
    // Backstop: a concurrent create beat the advisory lock (near-impossible
    // now) and the unique constraint stopped the second row. If this fires a
    // duplicate AWB likely exists at Delhivery — surface it loudly.
    if (err instanceof Prisma.PrismaClientKnownRequestError && err.code === "P2002") {
      console.error(
        `[Delhivery] DUPLICATE AWB LIKELY — order ${orderId}: create.json returned a waybill ` +
          `but a Shipment row already exists (P2002 on ${JSON.stringify(err.meta?.target)}). ` +
          `Reconcile with Delhivery (cancel the orphaned AWB).`
      );
      const existing = await prisma.shipment.findUnique({ where: { orderId } });
      if (existing) {
        return { waybill: existing.waybill, trackingUrl: existing.trackingUrl ?? trackUrl(existing.waybill) };
      }
    }
    throw err;
  }
}

// Past the advisory lock + existence/status re-check: build the payload, call
// create.json, and persist — all on the caller's transaction client so the
// Shipment row + the order's move to PROCESSING commit together and the lock
// releases atomically with them.
async function createShipmentLocked(
  tx: Prisma.TransactionClient,
  order: ShipmentOrder
): Promise<{ waybill: string; trackingUrl: string }> {
  const orderId = order.id;
  const destPincode = order.deliveryPincode || order.dealer.pincode;
  const destCity = order.deliveryCity || order.dealer.city;
  const destState = order.deliveryState || order.dealer.state;
  const destAddress = order.shippingAddress || order.dealer.address;
  const destName = order.deliveryName || order.dealer.ownerName;
  const destPhone = order.deliveryPhone || order.dealer.phone;

  if (!destAddress || !destPincode) {
    throw new Error(`Order ${orderId} has no shipping address/pincode and dealer has none on file — cannot create shipment`);
  }

  const totalWeight = order.items.reduce((sum, item) => {
    const w = item.product.packageWeight ?? item.product.weight ?? 0.5;
    return sum + w * item.quantity;
  }, 0);

  // payment_mode / cod_amount track what is still owed AT DELIVERY, not the
  // paymentType label:
  //   COD        -> amountDue == grandTotal  -> COD, collect the whole thing
  //   ADVANCE_20 -> amountDue == the 80% balance (the 20% was captured online
  //                 at finalize) -> COD, the courier must collect that balance
  //   FULL_100   -> amountDue == 0           -> Prepaid, collect nothing
  // Reading paymentType === "COD" only (the old logic) shipped every ADVANCE_20
  // order Prepaid with cod_amount 0, so the 80% was never collected on delivery.
  const codAmount = roundToPaise(Math.max(0, order.amountDue));
  const paymentMode: "COD" | "Prepaid" = codAmount > 0 ? "COD" : "Prepaid";

  const productDesc = order.items
    .map((i) => `${i.product.name} x${i.quantity}`)
    .join(", ")
    .slice(0, 100);

  const hsnCode = order.items[0]?.product.hsnCode || "87141090";

  const request = buildCreateShipmentRequest({
    destName,
    destAddress,
    destPincode,
    destCity,
    destState,
    destPhone: destPhone.replace(/\D/g, "").slice(-10),
    orderRef: order.orderNumber,
    paymentMode,
    codAmount,
    totalAmount: order.grandTotal,
    productsDesc: productDesc,
    hsnCode,
    quantity: order.items.reduce((s, i) => s + i.quantity, 0),
    weightKg: Math.max(0.5, totalWeight),
    addressType: "office",
    orderDate: order.createdAt.toISOString().split("T")[0],
  });

  const formData = {
    format: "json",
    data: JSON.stringify(request),
  };

  // F-03: create.json must NEVER be auto-retried — Delhivery can accept
  // attempt 1 before a client timeout/5xx, and a retry then creates a SECOND
  // real AWB that our Shipment.orderId unique constraint hides. retries:1 = one
  // attempt, no repeat. (Read-only Delhivery calls keep the default retries.)
  const response = await delhiveryPost<DelhiveryCreateShipmentResponse>(
    "/api/cmu/create.json",
    formData,
    { retries: 1 }
  );

  if (!response.success || !response.packages?.[0]) {
    throw new Error(
      `Delhivery shipment creation failed: ${response.packages?.[0]?.remarks || response.rmk || "Unknown error"}`
    );
  }

  const pkg = response.packages[0];

  if (pkg.status !== "Success") {
    throw new Error(`Delhivery rejected shipment: ${pkg.remarks}`);
  }

  const waybill = pkg.waybill;
  const trackingUrl = trackUrl(waybill);

  // Same transaction as the advisory lock — the Shipment row and the order's
  // move to PROCESSING commit together, then the lock releases. updateMany with
  // a status guard so a concurrently CANCELLED/DELIVERED order isn't dragged
  // back to PROCESSING; a 0-count there is fine, the Shipment row is what
  // matters. A P2002 here propagates to createDelhiveryShipment's backstop.
  await tx.shipment.create({
    data: {
      orderId: order.id,
      waybill,
      status: "MANIFESTED",
      trackingUrl,
      weight: Math.max(0.5, totalWeight),
    },
  });
  await tx.order.updateMany({
    where: { id: order.id, status: { in: ["CONFIRMED", "PROCESSING"] } },
    data: { status: "PROCESSING" },
  });

  return { waybill, trackingUrl };
}
