import { prisma } from "@/lib/prisma";
import type { DelhiveryWebhookPayload } from "./types";
import { normalizeShipmentStatus } from "./types";

const ORDER_STATUS_MAP: Record<string, string> = {
  PICKED_UP: "PROCESSING",
  IN_TRANSIT: "SHIPPED",
  OUT_FOR_DELIVERY: "SHIPPED",
  DELIVERED: "DELIVERED",
  RETURNED: "RETURNED",
  CANCELLED: "CANCELLED",
};

export async function processDelhiveryWebhook(
  payload: DelhiveryWebhookPayload
): Promise<{ processed: boolean; waybill: string }> {
  const waybill = payload.waybill;
  if (!waybill) return { processed: false, waybill: "" };

  const rawStatus = payload.status || payload["package-status"] || "";
  const location = payload.location || payload["current-location"] || "";
  const remarks = payload.remarks || rawStatus;
  const updatedAt = payload.updated_at || payload["updated-at"] || new Date().toISOString();
  const expectedDate = payload.expected_date || payload["expected-date"] || null;

  const normalizedStatus = normalizeShipmentStatus(rawStatus);

  const shipment = await prisma.shipment.findUnique({
    where: { waybill },
    include: { order: true },
  });

  if (!shipment) {
    console.warn(`[Delhivery Webhook] Unknown waybill: ${waybill}`);
    return { processed: false, waybill };
  }

  const timestamp = new Date(updatedAt);

  await prisma.$transaction(async (tx) => {
    await tx.shipmentTrackingEvent.create({
      data: {
        shipmentId: shipment.id,
        status: rawStatus,
        location,
        activity: remarks,
        timestamp: isNaN(timestamp.getTime()) ? new Date() : timestamp,
      },
    });

    await tx.shipment.update({
      where: { id: shipment.id },
      data: {
        status: normalizedStatus as any,
        ...(expectedDate ? { expectedDelivery: new Date(expectedDate) } : {}),
        ...(normalizedStatus === "DELIVERED" ? { deliveredAt: new Date() } : {}),
      },
    });

    const orderStatus = ORDER_STATUS_MAP[normalizedStatus];
    if (orderStatus) {
      await tx.order.update({
        where: { id: shipment.orderId },
        data: { status: orderStatus as any },
      });
    }
  });

  return { processed: true, waybill };
}
