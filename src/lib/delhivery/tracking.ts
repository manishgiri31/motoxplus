import { delhiveryFetch } from "./client";
import { prisma } from "@/lib/prisma";
import type {
  DelhiveryShipment,
  DelhiveryTrackNotFoundResponse,
  DelhiveryTrackResponse,
  TrackingResult,
} from "./types";
import { normalizeShipmentStatus } from "./types";

/**
 * Raw tracking lookup, typed against the real captured verbose=2 response.
 * Returns null when Delhivery has no record of the waybill — confirmed via a
 * live capture: HTTP 200 with `{Success:false, Error:"Data does not exists
 * for provided Waybill(s)"}`, not a 404 (delhivery-reference.md, "12. Track,
 * nonexistent AWB") — so callers can tell "unknown AWB" apart from "the API
 * call itself failed" (which throws). Same treatment as isServiceable().
 *
 * Always requests verbose=2: verbose 0/1/2 are confirmed strict supersets of
 * each other, so there's no cost, and Consignee lets us verify the
 * destination without joining back to our own order record.
 */
export async function fetchTrackingDetail(waybill: string): Promise<DelhiveryShipment | null> {
  const data = await delhiveryFetch<DelhiveryTrackResponse | DelhiveryTrackNotFoundResponse>(
    `/api/v1/packages/json/?waybill=${waybill}&verbose=2`
  );

  if ("Success" in data && data.Success === false) return null;

  const shipment = (data as DelhiveryTrackResponse).ShipmentData?.[0]?.Shipment;
  return shipment ?? null;
}

export async function fetchLiveTracking(waybill: string): Promise<TrackingResult> {
  try {
    const shipment = await fetchTrackingDetail(waybill);

    if (!shipment) {
      return { waybill, status: "PENDING", currentLocation: "", estimatedDelivery: null, events: [], error: "No tracking data" };
    }

    const currentStatus = shipment.Status?.Status || "In Transit";
    const normalizedStatus = normalizeShipmentStatus(currentStatus);

    const events = (shipment.Scans || []).map((scan) => ({
      status: scan.ScanDetail.Scan,
      location: scan.ScanDetail.ScannedLocation,
      activity: scan.ScanDetail.Instructions || scan.ScanDetail.Scan,
      timestamp: scan.ScanDetail.ScanDateTime || scan.ScanDetail.StatusDateTime,
    }));

    return {
      waybill,
      status: normalizedStatus,
      currentLocation: shipment.Status?.StatusLocation || "",
      estimatedDelivery: shipment.ExpectedDeliveryDate || null,
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
