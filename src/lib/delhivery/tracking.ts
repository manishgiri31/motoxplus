import { delhiveryFetch } from "./client";
import { prisma } from "@/lib/prisma";
import type {
  DelhiveryShipment,
  DelhiveryTrackNotFoundResponse,
  DelhiveryTrackResponse,
  TrackingResult,
} from "./types";
import { normalizeShipmentStatus } from "./types";
import { isPreShipCarrierStatus } from "./carrier-status";
import { notifyOrderEvent, type OrderNotificationEvent } from "@/lib/push/order-notifications";

// Same subset as the webhook path: only ship / deliver are reachable here
// (PROCESSING / RETURNED transitions aren't surfaced in the app).
const NOTIFY_EVENT_BY_ORDER_STATUS: Record<string, OrderNotificationEvent> = {
  SHIPPED: "ORDER_SHIPPED",
  DELIVERED: "ORDER_DELIVERED",
};

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
export async function fetchTrackingDetail(
  waybill: string,
  opts?: { retries?: number }
): Promise<DelhiveryShipment | null> {
  const path = `/api/v1/packages/json/?waybill=${waybill}&verbose=2`;
  const data =
    opts?.retries !== undefined
      ? await delhiveryFetch<DelhiveryTrackResponse | DelhiveryTrackNotFoundResponse>(path, { retries: opts.retries })
      : await delhiveryFetch<DelhiveryTrackResponse | DelhiveryTrackNotFoundResponse>(path);

  if ("Success" in data && data.Success === false) return null;

  const shipment = (data as DelhiveryTrackResponse).ShipmentData?.[0]?.Shipment;
  return shipment ?? null;
}

/**
 * Pure map from a raw Delhivery shipment to our TrackingResult. Extracted so
 * syncTrackingToDb can hold the raw shipment (for the F-17 write-guard) while
 * still reusing exactly the same mapping the display path uses.
 */
export function mapTrackingDetail(waybill: string, shipment: DelhiveryShipment): TrackingResult {
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
}

export async function fetchLiveTracking(waybill: string): Promise<TrackingResult> {
  try {
    const shipment = await fetchTrackingDetail(waybill);

    if (!shipment) {
      return { waybill, status: "PENDING", currentLocation: "", estimatedDelivery: null, events: [], error: "No tracking data" };
    }

    return mapTrackingDetail(waybill, shipment);
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
    include: { order: { select: { status: true } } },
  });
  if (!shipment) return;

  const priorOrderStatus = shipment.order.status;

  // Fetch the RAW shipment (not fetchLiveTracking's normalized result) so the
  // F-17 write-guard below can read Status.Status / StatusCode / PickedupDate
  // directly — no second network call, one response covers both needs.
  let detail: DelhiveryShipment | null;
  try {
    detail = await fetchTrackingDetail(shipment.waybill);
  } catch {
    return; // fetch failed — leave DB untouched, same as the old error guard
  }
  if (!detail) return; // unknown AWB — nothing to sync

  const tracking = mapTrackingDetail(shipment.waybill, detail);

  const newStatus = tracking.status as any;

  // Set inside the transaction to the status we actually wrote, so the
  // post-commit push only fires on a genuine, applied transition.
  let appliedOrderStatus: string | null = null;

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

    const orderTarget = orderStatusMap[newStatus];

    // F-17 write-guard (AUDIT/01-findings.md). normalizeShipmentStatus has no
    // mapping for raw "Not Picked" and falls through to IN_TRANSIT → this map
    // would then record Order.status = SHIPPED for a parcel the courier never
    // collected, over-charging a pre-pickup cancellation at 20%. Before writing
    // a SHIPPED transition, confirm against the RAW carrier fields that the
    // parcel actually left. Deliberately narrow: does not touch the
    // Shipment.status write above, normalizeShipmentStatus, or the webhook.
    const rawSaysPreShip =
      orderTarget === "SHIPPED" &&
      isPreShipCarrierStatus({
        statusText: detail.Status?.Status,
        statusCode: detail.Status?.StatusCode,
        pickedUpDate: detail.PickedupDate,
      });

    if (orderTarget && !rawSaysPreShip) {
      await tx.order.update({
        where: { id: orderId },
        data: { status: orderTarget as any },
      });
      appliedOrderStatus = orderTarget;
    }
  });

  // Notify the dealer if the poller just advanced the order (fire-and-forget;
  // notifyOrderEvent dedupes against the webhook path and never throws).
  if (appliedOrderStatus && appliedOrderStatus !== priorOrderStatus) {
    const event = NOTIFY_EVENT_BY_ORDER_STATUS[appliedOrderStatus];
    if (event) void notifyOrderEvent(orderId, event);
  }
}
