import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { getCurrentUserId } from "@/lib/auth/current-user";
import { buildCancellationQuote, loadGateOrder } from "@/lib/orders/cancellation-gate";

/**
 * Read-only quote — the single source of truth the UI displays before a dealer
 * or admin confirms. POST .../cancel recomputes everything independently at
 * execution time rather than trusting anything from this response back.
 *
 * For an admin this makes ONE live Delhivery call (classifyCarrierTier) so the
 * displayed tier reflects raw carrier state, not the lagging Order.status.
 */
export async function GET(req: NextRequest, props: { params: Promise<{ id: string }> }) {
  const params = await props.params;
  const userId = await getCurrentUserId(req);
  if (!userId) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const authUser = await prisma.user.findUnique({ where: { id: userId }, select: { role: true } });
  if (!authUser) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const order = await loadGateOrder(params.id);
  if (!order) return NextResponse.json({ error: "Order not found" }, { status: 404 });

  const isDealerActor = authUser.role === "DEALER";

  if (isDealerActor) {
    const dealer = await prisma.dealer.findUnique({ where: { userId } });
    if (!dealer) return NextResponse.json({ error: "Forbidden" }, { status: 403 });
    const owns = await prisma.order.count({ where: { id: order.id, dealerId: dealer.id } });
    if (!owns) return NextResponse.json({ error: "Forbidden" }, { status: 403 });
  } else if (!["ADMIN", "SUPER_ADMIN", "ACCOUNTS"].includes(authUser.role)) {
    return NextResponse.json({ error: "Forbidden" }, { status: 403 });
  }

  const quote = await buildCancellationQuote(order, isDealerActor);
  return NextResponse.json(quote);
}
