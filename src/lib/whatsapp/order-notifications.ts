import { prisma } from "@/lib/prisma";
import { logger } from "@/lib/logger";
import { toWhatsAppPhone } from "@/lib/phone";
import { checkServiceability } from "@/lib/delhivery/serviceability";
import { sendTemplate } from "./send-template";

export type OrderWhatsAppEvent = "ORDER_CONFIRMED" | "ORDER_CANCELLED" | "ORDER_SHIPPED";

// Approved Utility templates. Body parameters, in order:
//   order_confirmed → customerName, orderId, itemsText, estimatedDeliveryDate
//   order_cancelled → customerName, orderId, cancelReason
//   order_shipped   → customerName, orderId, courierName, awbNumber, expectedDeliveryDate
export const ORDER_TEMPLATES: Record<OrderWhatsAppEvent, string> = {
  ORDER_CONFIRMED: "order_confirmed",
  ORDER_CANCELLED: "order_cancelled",
  ORDER_SHIPPED: "order_shipped",
};

// The Order column that records "this event has been messaged".
const FLAG_BY_EVENT = {
  ORDER_CONFIRMED: "confirmationSentAt",
  ORDER_CANCELLED: "cancelNotifiedAt",
  ORDER_SHIPPED: "shippedNotifiedAt",
} as const;

const COURIER_NAME = "Delhivery";
const DEFAULT_CANCEL_REASON = "Requested by customer";
const MAX_ITEMS_TEXT = 300;

// Raw Delhivery status strings (Status.Status in tracking, `status` /
// `package-status` in the webhook) that mean "the parcel has left us". Matched
// exactly (case/whitespace-insensitive), NOT with the substring match
// normalizeShipmentStatus uses — that one maps anything unrecognised
// (e.g. "Not Picked") to IN_TRANSIT, which must never produce a "shipped"
// message. Note Delhivery's own "Dispatched" means out for delivery.
const SHIPPED_CARRIER_STATUSES = new Set(["in transit", "dispatched"]);

export function isShippedCarrierStatus(rawStatus: string | null | undefined): boolean {
  return !!rawStatus && SHIPPED_CARRIER_STATUSES.has(rawStatus.trim().toLowerCase());
}

const orderInclude = {
  items: { include: { product: { select: { name: true } } } },
  shipment: { select: { waybill: true, expectedDelivery: true } },
  cancellation: { select: { reason: true } },
  customer: { include: { user: { select: { name: true, mobileNumber: true } } } },
  dealer: { select: { ownerName: true, phone: true } },
} as const;

type LoadedOrder = NonNullable<Awaited<ReturnType<typeof loadOrderForWhatsApp>>>;

export function loadOrderForWhatsApp(orderId: string) {
  return prisma.order.findUnique({ where: { id: orderId }, include: orderInclude });
}

function formatDate(date: Date): string {
  return date.toLocaleDateString("en-IN", { day: "numeric", month: "short", year: "numeric", timeZone: "Asia/Kolkata" });
}

function recipientName(order: LoadedOrder): string {
  return order.deliveryName?.trim() || order.customer?.user.name?.trim() || order.dealer?.ownerName?.trim() || "Customer";
}

function recipientPhone(order: LoadedOrder): string | null {
  return (
    toWhatsAppPhone(order.deliveryPhone) ??
    toWhatsAppPhone(order.customer?.user.mobileNumber) ??
    toWhatsAppPhone(order.dealer?.phone)
  );
}

function itemsText(order: LoadedOrder): string {
  const text = order.items
    .map((item) => ({ name: item.product.name, qty: item.quantity - item.cancelledQuantity }))
    .filter((item) => item.qty > 0)
    .map((item) => `${item.name} x${item.qty}`)
    .join(", ");
  return text.length > MAX_ITEMS_TEXT ? `${text.slice(0, MAX_ITEMS_TEXT - 1)}…` : text;
}

// Confirmation fires before the shipment exists (auto-shipment is booked right
// after), so there is usually no carrier ETA yet — fall back to Delhivery's
// serviceability estimate for the delivery pincode, then to a placeholder.
async function estimatedDeliveryDate(order: LoadedOrder): Promise<string> {
  if (order.shipment?.expectedDelivery) return formatDate(order.shipment.expectedDelivery);
  if (order.deliveryPincode) {
    try {
      const { estimatedDeliveryDays } = await checkServiceability(order.deliveryPincode);
      if (estimatedDeliveryDays) return formatDate(new Date(Date.now() + estimatedDeliveryDays * 24 * 60 * 60 * 1000));
    } catch {
      // fall through to the placeholder
    }
  }
  return "To be confirmed";
}

/** Template body parameters for one event, in the order Meta expects them. */
export async function buildTemplateValues(order: LoadedOrder, event: OrderWhatsAppEvent): Promise<string[]> {
  const name = recipientName(order);
  switch (event) {
    case "ORDER_CONFIRMED":
      return [name, order.orderNumber, itemsText(order), await estimatedDeliveryDate(order)];
    case "ORDER_CANCELLED":
      // No OrderCancellation row means the carrier cancelled the shipment
      // (Delhivery webhook); the cancel route always writes one.
      return [
        name,
        order.orderNumber,
        order.cancellation ? order.cancellation.reason?.trim() || DEFAULT_CANCEL_REASON : "Shipment cancelled by the courier",
      ];
    case "ORDER_SHIPPED":
      return [
        name,
        order.orderNumber,
        COURIER_NAME,
        order.shipment?.waybill ?? "-",
        order.shipment?.expectedDelivery ? formatDate(order.shipment.expectedDelivery) : "To be confirmed",
      ];
  }
}

function notificationsEnabled(): boolean {
  return process.env.WHATSAPP_ORDER_NOTIFICATIONS === "true";
}

/**
 * Sends the WhatsApp template for one order event, at most once per order.
 *
 * Fire-and-forget safe: never throws, so a Meta outage, an unapproved
 * template or a bad phone number can't affect the order status update that
 * triggered it. Off unless WHATSAPP_ORDER_NOTIFICATIONS=true.
 *
 * Duplicate protection: the Order's per-event timestamp flag is claimed with
 * a conditional UPDATE (only one concurrent caller sees count 1 — e.g. the
 * Delhivery webhook and the tracking poller racing on the same scan) and
 * released again if the send fails, so a later trigger can retry.
 */
export async function notifyOrderWhatsApp(orderId: string, event: OrderWhatsAppEvent): Promise<void> {
  if (!notificationsEnabled()) return;

  const flag = FLAG_BY_EVENT[event];
  let claimed = false;
  try {
    const order = await loadOrderForWhatsApp(orderId);
    if (!order || order[flag]) return;

    // A "shipped" message for an order that's already delivered/returned/
    // cancelled (late or replayed carrier scan) would be wrong.
    if (event === "ORDER_SHIPPED" && ["DELIVERED", "RETURNED", "CANCELLED"].includes(order.status)) return;
    if (event === "ORDER_SHIPPED" && !order.shipment?.waybill) return;

    const phone = recipientPhone(order);
    if (!phone) {
      logger.warn("[WhatsApp] Order notification skipped — no valid recipient number", { orderId, event });
      return;
    }

    const claim = await prisma.order.updateMany({ where: { id: orderId, [flag]: null }, data: { [flag]: new Date() } });
    if (claim.count === 0) return;
    claimed = true;

    await sendTemplate(phone, ORDER_TEMPLATES[event], await buildTemplateValues(order, event));
  } catch (err) {
    // sendTemplate has already logged the Meta error detail; this line only
    // records which order/event failed. No phone, no token.
    logger.error("[WhatsApp] Order notification failed", {
      orderId,
      event,
      reason: err instanceof Error ? err.message : "unknown",
    });
    if (claimed) {
      await prisma.order.updateMany({ where: { id: orderId }, data: { [flag]: null } }).catch(() => undefined);
    }
  }
}
