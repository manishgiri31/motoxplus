import { delhiveryFetch } from "./client";
import { prisma } from "@/lib/prisma";
import type { DelhiveryTrackResponse, TrackingResult } from "./types";
import { normalizeShipmentStatus } from "./types";

export async function fetchLiveTracking(waybill: string): Promise<TrackingResult> {
  try {
    const data = await delhiveryFetch<DelhiveryTrackResponse>(
      `/api/v1/packages/json/?waybill=${waybill}&verbose=0`
    );

    const shipmentData = data?.ShipmentData?.[0];
    if (!shipmentData) {
      return { waybill, status: "PENDING", currentLocation: "", estimatedDelivery: null, events: [], error: "No tracking data" };
    }

    const { Shipment, Scans } = shipmentData;
    const currentStatus = Shipment.Status?.Status || "In Transit";
    const normalizedStatus = normalizeShipmentStatus(currentStatus);

    const events = (Scans || []).map((scan) => ({
      status: scan.ScanDetail.Scan,
      location: scan.ScanDetail.ScannedLocation,
      activity: scan.ScanDetail.Instructions || scan.ScanDetail.Scan,
      timestamp: scan.ScanDetail.ScanDateTime || scan.ScanDetail.StatusDateTime,
    }));

    return {
      waybill,
      status: normalizedStatus,
      currentLocation: Shipment.Status?.StatusLocation || "",
      estimatedDelivery: Shipment.ExpectedDeliveryDate || null,
      events,
    };
  } catch (err) {
    console.error("[Delhivery] tracking fetch failed:", err);
    return {
      waybill,
      status: "IN_TRANSIT",
      currentLocation: "",
      estimatedDelivery: null,
      events: [],
      error: "Unable to fetch live tracking. Please try again later.",
    };
  }
}

export async function syncTrackingToDb(orderId: string): Promise<void> {
  const shipment = await prisma.shipment.findUnique({
    where: { orderId },
  });
  if (!shipment) return;

  const tracking = await fetchLiveTracking(shipment.waybill);
  if (tracking.error && tracking.events.length === 0) return;

  const newStatus = tracking.status as any;

  await prisma.$transaction(async (tx) => {
    // Upsert each tracking event by timestamp
    for (const event of tracking.events) {
      const ts = new Date(event.timestamp);
      if (isNaN(ts.getTime())) continue;

      await tx.shipmentTrackingEvent.upsert({
        where: {
          id: `${shipment.id}_${ts.getTime()}`,
        },
        update: {},
        create: {
          id: `${shipment.id}_${ts.getTime()}`,
          shipmentId: shipment.id,
          status: event.status,
          location: event.location,
          activity: event.activity,
          timestamp: ts,
        },
      });
    }

    await tx.shipment.update({
      where: { id: shipment.id },
      data: {
        status: newStatus,
        ...(tracking.estimatedDelivery
          ? { expectedDelivery: new Date(tracking.estimatedDelivery) }
          : {}),
        ...(newStatus === "DELIVERED" ? { deliveredAt: new Date() } : {}),
      },
    });

    // Mirror critical statuses to Order
    const orderStatusMap: Record<string, string> = {
      PICKED_UP: "PROCESSING",
      IN_TRANSIT: "SHIPPED",
      OUT_FOR_DELIVERY: "SHIPPED",
      DELIVERED: "DELIVERED",
      RETURNED: "RETURNED",
    };

    if (orderStatusMap[newStatus]) {
      await tx.order.update({
        where: { id: orderId },
        data: { status: orderStatusMap[newStatus] as any },
      });
    }
  });
}
