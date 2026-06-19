import { NextRequest, NextResponse } from "next/server";
import { getServerSession } from "next-auth";
import { authOptions } from "@/lib/auth";
import { prisma } from "@/lib/prisma";
import { fetchLiveTracking, syncTrackingToDb } from "@/lib/delhivery";

export async function GET(
  req: NextRequest,
  { params }: { params: { id: string } }
) {
  const session = await getServerSession(authOptions);
  if (!session) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

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
  if (session.user.role === "DEALER") {
    const dealer = await prisma.dealer.findUnique({ where: { userId: session.user.id } });
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
