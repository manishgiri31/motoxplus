import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { fetchLiveTracking, syncTrackingToDb } from "@/lib/delhivery";
import { getCurrentUserId } from "@/lib/auth/current-user";

// Accepts either the web NextAuth session or the mobile/plain-login JWT
// (cookie or Bearer) via getCurrentUserId — see lib/auth/current-user.ts.
export async function GET(req: NextRequest, props: { params: Promise<{ id: string }> }) {
  const params = await props.params;
  const userId = await getCurrentUserId(req);
  if (!userId) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  const authUser = await prisma.user.findUnique({ where: { id: userId }, select: { role: true } });
  if (!authUser) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const order = await prisma.order.findUnique({
    where: { id: params.id },
    include: {
      shipment: {
        include: { events: { orderBy: { timestamp: "desc" } } },
      },
      dealer: true,
    },
  });

  if (!order) return NextResponse.json({ error: "Order not found" }, { status: 404 });

  // Dealer access control
  if (authUser.role === "DEALER") {
    const dealer = await prisma.dealer.findUnique({ where: { userId } });
    if (order.dealerId !== dealer?.id) {
      return NextResponse.json({ error: "Forbidden" }, { status: 403 });
    }
  }

  if (!order.shipment) {
    return NextResponse.json({ error: "Shipment not created yet" }, { status: 404 });
  }

  // Refresh from Delhivery if last update was > 30 minutes ago
  const thirtyMinAgo = new Date(Date.now() - 30 * 60 * 1000);
  if (order.shipment.updatedAt < thirtyMinAgo) {
    await syncTrackingToDb(order.id).catch(console.error);
  }

  // Fetch fresh DB state
  const shipment = await prisma.shipment.findUnique({
    where: { id: order.shipment.id },
    include: { events: { orderBy: { timestamp: "desc" } } },
  });

  const liveTracking = await fetchLiveTracking(order.shipment.waybill).catch(() => null);

  return NextResponse.json({
    orderId: order.id,
    orderNumber: order.orderNumber,
    waybill: shipment!.waybill,
    status: shipment!.status,
    currentLocation: liveTracking?.currentLocation || "",
    lastUpdate: shipment!.updatedAt.toISOString(),
    estimatedDelivery: shipment!.expectedDelivery?.toISOString() || liveTracking?.estimatedDelivery || null,
    trackingUrl: shipment!.trackingUrl,
    events: (shipment!.events || []).map((e) => ({
      status: e.status,
      location: e.location,
      activity: e.activity,
      timestamp: e.timestamp.toISOString(),
    })),
  });
}
