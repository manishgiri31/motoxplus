import { prisma } from "@/lib/prisma";
import { createDelhiveryShipment } from "./shipment";

/**
 * Master switch for AUTOMATIC Delhivery shipment creation — the order reaches
 * CONFIRMED (COD at placement, prepaid at payment finalization) and a shipment
 * is created without an operator doing anything.
 *
 * Default ON. Auto-creation is skipped ONLY when DELHIVERY_AUTO_SHIPMENT is
 * explicitly "false" (case-insensitive, surrounding whitespace ignored). Unset,
 * "true", "1", or any other value leaves it ON.
 *
 * The manual admin trigger (POST /api/admin/shipments) calls
 * createDelhiveryShipment directly and ignores this flag, so an operator can
 * always create a shipment by hand. Intended use: live-key testing — flip it
 * off, place real orders without burning real AWBs, then create the one
 * shipment you actually want to test from the admin Shipments screen.
 */
export function isAutoShipmentEnabled(): boolean {
  return (process.env.DELHIVERY_AUTO_SHIPMENT ?? "true").trim().toLowerCase() !== "false";
}

/**
 * Fire-and-forget auto shipment creation for an order that has just reached
 * CONFIRMED. Call as `void autoCreateShipment(orderId)` — never await it inside
 * the order/payment transaction.
 *
 * Guarantees:
 *  - never throws — a Delhivery outage must not roll back or block the
 *    order-placement / payment-finalization that scheduled it;
 *  - every outcome (created / skipped / failed) is written to OrderEvent, not
 *    just the console, so support and the admin order timeline can see why a
 *    confirmed order has no shipment;
 *  - idempotent — createDelhiveryShipment has its own DB-level guard (Postgres
 *    advisory lock + unique constraint), so a double-fire (verify + webhook,
 *    a Razorpay webhook retry, a manual trigger racing this) is safe.
 */
export async function autoCreateShipment(orderId: string): Promise<void> {
  if (!isAutoShipmentEnabled()) {
    console.warn(
      `[Delhivery] auto-shipment disabled (DELHIVERY_AUTO_SHIPMENT=false) — order ${orderId} left for the manual admin trigger`
    );
    await recordShipmentEvent(
      orderId,
      "SHIPMENT_AUTO_SKIPPED",
      "DELHIVERY_AUTO_SHIPMENT=false — create the shipment from the admin Shipments screen"
    );
    return;
  }

  try {
    const { waybill } = await createDelhiveryShipment(orderId);
    await recordShipmentEvent(orderId, "SHIPMENT_CREATED", `Delhivery AWB ${waybill}`);
  } catch (err) {
    const message = err instanceof Error ? err.message : String(err);
    console.error(`[Delhivery] auto-shipment failed for order ${orderId}: ${message}`);
    await recordShipmentEvent(orderId, "SHIPMENT_FAILED", message.slice(0, 500));
  }
}

async function recordShipmentEvent(orderId: string, type: string, reason: string): Promise<void> {
  try {
    await prisma.orderEvent.create({ data: { orderId, type, reason } });
  } catch (err) {
    // Diagnostics only, not the transaction of record — if even this write
    // fails, log and move on rather than throwing out of a fire-and-forget path.
    console.error(`[Delhivery] could not record ${type} OrderEvent for order ${orderId}:`, err);
  }
}
