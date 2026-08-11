import { NextRequest, NextResponse } from "next/server";
import { getServerSession } from "next-auth";
import { authOptions } from "@/lib/auth";
import { prisma } from "@/lib/prisma";
import { getCurrentUserId } from "@/lib/auth/current-user";
import { requireSectionAccess } from "@/lib/staff-access";
import { OrderStatus } from "@prisma/client";

// Accepts either the web NextAuth session or the mobile/plain-login JWT
// (cookie or Bearer) via getCurrentUserId — see lib/auth/current-user.ts.
export async function GET(req: NextRequest, props: { params: Promise<{ id: string }> }) {
  const params = await props.params;
  const userId = await getCurrentUserId(req);
  if (!userId) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  const authUser = await prisma.user.findUnique({ where: { id: userId }, select: { role: true, department: true } });
  if (!authUser) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const order = await prisma.order.findUnique({
    where: { id: params.id },
    include: {
      dealer: { include: { user: true } },
      items: { include: { product: { include: { category: true } } } },
      payments: true,
      invoice: true,
      shipment: {
        include: { events: { orderBy: { timestamp: "desc" } } },
      },
    },
  });

  if (!order) return NextResponse.json({ error: "Order not found" }, { status: 404 });

  // Dealer can only view own orders; any other role needs admin/order-section
  // staff access — without this branch, a VENDOR (public self-registration)
  // or any non-DEALER role could fetch any order by id (IDOR).
  if (authUser.role === "DEALER") {
    const dealer = await prisma.dealer.findUnique({ where: { userId } });
    if (order.dealerId !== dealer?.id) {
      return NextResponse.json({ error: "Forbidden" }, { status: 403 });
    }
  } else if (!requireSectionAccess(authUser.role, authUser.department, "orders")) {
    return NextResponse.json({ error: "Forbidden" }, { status: 403 });
  }

  return NextResponse.json(order);
}

// Fulfillment-only transitions reachable from this generic admin route.
// CONFIRMED is deliberately excluded — it's only ever set alongside an atomic
// stock reservation by the payment paths (COD creation, Razorpay verify, UPI
// admin verify — see lib/orders/stock.ts), and setting it here would mark an
// order confirmed without reserving stock. CANCELLED is excluded because
// /api/orders/[id]/cancel owns that transition (refund + restock + audit
// trail) — going through this route instead would skip all of that. This
// keeps payment/cancellation state settable only by their dedicated,
// verified paths, never by a generic field update (see SECURITY audit).
const FULFILLMENT_TRANSITIONS: Partial<Record<OrderStatus, OrderStatus[]>> = {
  CONFIRMED: ["PROCESSING"],
  PROCESSING: ["SHIPPED"],
  SHIPPED: ["DELIVERED"],
  DELIVERED: ["RETURNED"],
};

export async function PATCH(req: NextRequest, props: { params: Promise<{ id: string }> }) {
  const params = await props.params;
  const session = await getServerSession(authOptions);
  if (!session || !["ADMIN", "SUPER_ADMIN"].includes(session.user.role)) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const { status } = await req.json().catch(() => ({}));

  const current = await prisma.order.findUnique({ where: { id: params.id }, select: { status: true } });
  if (!current) return NextResponse.json({ error: "Order not found" }, { status: 404 });

  const allowedNext = FULFILLMENT_TRANSITIONS[current.status] ?? [];
  if (typeof status !== "string" || !allowedNext.includes(status as OrderStatus)) {
    return NextResponse.json(
      { error: `Cannot move order from ${current.status} to ${status ?? "(missing)"}`, code: "INVALID_STATUS_TRANSITION" },
      { status: 409 }
    );
  }

  // Guarded on the status we just read — if it changed between the read above
  // and this write (concurrent update), fail rather than applying a
  // transition against a status the caller no longer has an accurate picture
  // of, matching the guarded-update pattern used by the cancel/payment routes.
  const guarded = await prisma.order.updateMany({
    where: { id: params.id, status: current.status },
    data: { status: status as OrderStatus },
  });
  if (guarded.count === 0) {
    return NextResponse.json({ error: "Order status changed, please retry", code: "ORDER_CHANGED" }, { status: 409 });
  }

  const order = await prisma.order.findUnique({ where: { id: params.id } });
  return NextResponse.json(order);
}
