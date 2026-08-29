import type { Order, OrderCancellation, Shipment } from "@prisma/client";
import { prisma } from "@/lib/prisma";
import { sendExpoPushNotifications } from "./send";

export type OrderNotificationEvent =
  | "ORDER_CONFIRMED"
  | "ORDER_SHIPPED"
  | "ORDER_DELIVERED"
  | "ORDER_CANCELLED";

type OrderForNotification = Order & {
  shipment: Pick<Shipment, "waybill"> | null;
  cancellation: Pick<OrderCancellation, "refundStatus" | "refundAmount"> | null;
};

function formatAmount(n: number): string {
  return `₹${n.toFixed(2)}`;
}

function buildMessage(
  order: OrderForNotification,
  event: OrderNotificationEvent
): { title: string; body: string } {
  const ref = `Order #${order.orderNumber}`;

  switch (event) {
    case "ORDER_CONFIRMED":
      return { title: "Order confirmed", body: `${ref} is confirmed and is being prepared for dispatch.` };

    case "ORDER_SHIPPED":
      return {
        title: "Order shipped",
        body: order.shipment?.waybill
          ? `${ref} has been shipped. Track it with waybill ${order.shipment.waybill}.`
          : `${ref} has been shipped and is on its way.`,
      };

    case "ORDER_DELIVERED":
      return { title: "Order delivered", body: `${ref} has been delivered.` };

    case "ORDER_CANCELLED": {
      const refundStatus = order.cancellation?.refundStatus;
      const refundAmount = order.cancellation?.refundAmount ?? 0;
      let refundLine = "";
      if (refundStatus && refundStatus !== "NOT_APPLICABLE" && refundAmount > 0) {
        const phase =
          refundStatus === "PROCESSED"
            ? "has been processed"
            : refundStatus === "FAILED"
              ? "could not be processed — our team will be in touch"
              : "has been initiated";
        refundLine = ` A refund of ${formatAmount(refundAmount)} ${phase}.`;
      }
      return { title: "Order cancelled", body: `${ref} has been cancelled.${refundLine}` };
    }
  }
}

/**
 * Sends a push to every device the order's dealer has registered, for a real
 * order-lifecycle transition. Call it fire-and-forget from wherever
 * Order.status actually changes — it never throws, and it dedupes on the
 * existing OrderEvent audit trail so the same transition observed by two code
 * paths (e.g. the Delhivery webhook and the tracking-sync poller both seeing
 * SHIPPED) only notifies once.
 */
export async function notifyOrderEvent(orderId: string, event: OrderNotificationEvent): Promise<void> {
  try {
    const markerType = `PUSH_${event}`;

    const already = await prisma.orderEvent.findFirst({
      where: { orderId, type: markerType },
      select: { id: true },
    });
    if (already) return;

    const order = await prisma.order.findUnique({
      where: { id: orderId },
      include: {
        shipment: { select: { waybill: true } },
        cancellation: { select: { refundStatus: true, refundAmount: true } },
      },
    });
    if (!order) return;

    const { title, body } = buildMessage(order, event);

    const tokens = await prisma.deviceToken.findMany({
      where: { dealerId: order.dealerId },
      select: { token: true },
    });

    // Record the marker up front, even with zero devices — a device that
    // registers moments later (right after login) should not then receive a
    // backfilled burst of every transition the order has already been through.
    await prisma.orderEvent.create({ data: { orderId, type: markerType, reason: body } });

    if (tokens.length === 0) return;

    await sendExpoPushNotifications(
      tokens.map((t) => ({
        to: t.token,
        title,
        body,
        sound: "default",
        channelId: "orders",
        data: {
          orderId: order.id,
          orderNumber: order.orderNumber,
          event,
          url: `/order/${order.id}`,
        },
      }))
    );
  } catch (err) {
    console.error(`[Push] notifyOrderEvent(${orderId}, ${event}) failed:`, err);
  }
}
