import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { generateOrderNumber, roundToPaise } from "@/lib/utils";
import { getCurrentUserId } from "@/lib/auth/current-user";
import { getVerifiedDealer, ACCOUNT_NOT_VERIFIED_MESSAGE } from "@/lib/auth/verified-account";
import { enforceRateLimit, rejectOversizedBody } from "@/lib/auth/rate-limit-budgets";

const FREE_DELIVERY_THRESHOLD = 25000;

function calcShipping(orderTotal: number): number {
  if (orderTotal >= FREE_DELIVERY_THRESHOLD) return 0;
  return Math.round(orderTotal * 0.05 * 100) / 100;
}

export async function GET(req: NextRequest) {
  // Accepts either the web NextAuth session or the mobile/plain-login JWT
  // (cookie or Bearer) via getCurrentUserId — see lib/auth/current-user.ts.
  const userId = await getCurrentUserId(req);
  if (!userId) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const authUser = await prisma.user.findUnique({ where: { id: userId }, select: { role: true } });
  if (!authUser) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const { searchParams } = new URL(req.url);
  const page = parseInt(searchParams.get("page") || "1");
  const pageSize = 10;

  if (authUser.role === "DEALER") {
    const dealer = await prisma.dealer.findUnique({ where: { userId } });
    if (!dealer) return NextResponse.json({ error: "Dealer not found" }, { status: 404 });

    const [orders, total] = await Promise.all([
      prisma.order.findMany({
        where: { dealerId: dealer.id },
        include: { items: { include: { product: true } }, invoice: true, shipment: true },
        orderBy: { createdAt: "desc" },
        skip: (page - 1) * pageSize,
        take: pageSize,
      }),
      prisma.order.count({ where: { dealerId: dealer.id } }),
    ]);

    return NextResponse.json({ orders, total, page, pageSize });
  }

  if (authUser.role === "ADMIN" || authUser.role === "SUPER_ADMIN") {
    const [orders, total] = await Promise.all([
      prisma.order.findMany({
        include: {
          dealer: { include: { user: true } },
          items: { include: { product: true } },
          invoice: true,
          shipment: true,
        },
        orderBy: { createdAt: "desc" },
        skip: (page - 1) * pageSize,
        take: pageSize,
      }),
      prisma.order.count(),
    ]);

    return NextResponse.json({ orders, total, page, pageSize });
  }

  return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
}

export async function POST(req: NextRequest) {
  const oversized = rejectOversizedBody(req, 8 * 1024);
  if (oversized) return oversized;

  const userId = await getCurrentUserId(req);
  if (!userId) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }
  const authUser = await prisma.user.findUnique({ where: { id: userId }, select: { role: true } });
  if (!authUser || authUser.role !== "DEALER") {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const {
    paymentType,
    notes,
    deliveryName,
    deliveryPhone,
    deliveryAddress,
    deliveryCity,
    deliveryState,
    deliveryPincode,
    clientShippingCost,
  } = await req.json();

  // Pure COD (nothing paid upfront) was removed 2026-09-13 — every new order
  // is either paid in full now or via a 20% advance now with the remaining
  // 80% collected as cash/COD by the courier at delivery (see
  // lib/delhivery/shipment.ts's codAmount/paymentMode derivation, which
  // already keys off amountDue rather than this label). Historical orders
  // with paymentType COD still exist and are handled read-only everywhere
  // else (cancellation, shipment, invoices) — only creation is blocked here.
  if (!paymentType || !["ADVANCE_20", "FULL_100"].includes(paymentType)) {
    return NextResponse.json({ error: "Invalid payment type" }, { status: 400 });
  }

  if (!deliveryPincode || !/^\d{6}$/.test(deliveryPincode)) {
    return NextResponse.json({ error: "Valid delivery pincode is required" }, { status: 400 });
  }

  const dealer = await getVerifiedDealer(userId);
  if (!dealer) return NextResponse.json({ error: ACCOUNT_NOT_VERIFIED_MESSAGE }, { status: 403 });

  const limited = await enforceRateLimit(req, "ORDER_CREATE", dealer.id);
  if (limited) return limited;

  const cart = await prisma.cart.findUnique({
    where: { dealerId: dealer.id },
    include: { items: { include: { product: true, variant: true } } },
  });

  if (!cart || cart.items.length === 0) {
    return NextResponse.json({ error: "Cart is empty" }, { status: 400 });
  }

  // Cart items can sit for a long time between add-to-cart and checkout —
  // re-check availability now rather than trusting whatever was true when the
  // item was added. Price is always read fresh from product/variant below
  // (the cart never snapshots a price), so that part can't go stale; stock
  // and active status can, and previously were never re-checked here.
  const unavailable = cart.items.filter((item) => {
    if (!item.product.isActive) return true;
    if (item.variant) return !item.variant.isActive || item.variant.stock < item.quantity;
    return item.product.stock < item.quantity;
  });
  if (unavailable.length > 0) {
    return NextResponse.json(
      {
        error: "Some items in your cart are no longer available in the requested quantity. Please update your cart.",
        unavailableProductIds: unavailable.map((i) => i.productId),
      },
      { status: 409 }
    );
  }

  let subtotal = 0;
  let gstAmount = 0;

  for (const item of cart.items) {
    const unitPrice = item.variant?.price ?? item.product.price;
    const itemSubtotal = unitPrice * item.quantity;
    const itemGST = (itemSubtotal * item.product.gstRate) / 100;
    subtotal += itemSubtotal;
    gstAmount += itemGST;
  }

  // Round at each step — these are stored as Float columns, and summing many
  // unrounded unitPrice*quantity*gstRate/100 terms accumulates floating-point
  // drift (see roundToPaise in lib/utils.ts).
  subtotal = roundToPaise(subtotal);
  gstAmount = roundToPaise(gstAmount);

  const shippingCost = calcShipping(subtotal + gstAmount);

  const grandTotal = roundToPaise(subtotal + gstAmount + shippingCost);

  const amountDue = roundToPaise(
    paymentType === "ADVANCE_20" ? grandTotal * 0.2 : grandTotal
  );

  // Every order (ADVANCE_20 or FULL_100) is now born PENDING/unreserved —
  // stock is only decremented and the invoice only generated at payment
  // finalization (lib/payments/finalize.ts for Razorpay, admin/payments/[id]/
  // verify for manual UPI). This used to branch on isCOD (COD orders were
  // created pre-CONFIRMED with stock reserved immediately); that branch was
  // removed with pure COD itself on 2026-09-13 — see the PaymentType.COD
  // doc comment in prisma/schema.prisma.
  const order = await prisma.order.create({
    data: {
      orderNumber: generateOrderNumber(),
      dealerId: dealer.id,
      subtotal,
      gstAmount,
      shippingCost,
      grandTotal,
      paymentType,
      amountDue,
      amountPaid: 0,
      notes,
      status: "PENDING",
      paymentStatus: "PENDING",
      stockReserved: false,
      shippingAddress: deliveryAddress,
      deliveryName: deliveryName || dealer.ownerName,
      deliveryPhone: deliveryPhone || dealer.phone,
      deliveryCity: deliveryCity || dealer.city,
      deliveryState: deliveryState || dealer.state,
      deliveryPincode,
      items: {
        create: cart.items.map((item) => {
          const unitPrice = item.variant?.price ?? item.product.price;
          // total derived from the already-rounded gstAmount (rather than its
          // own independent unitPrice*qty*(1+gstRate/100) expression) so the
          // two can't drift apart by a floating-point epsilon.
          const itemGstAmount = roundToPaise((unitPrice * item.quantity * item.product.gstRate) / 100);
          const itemTotal = roundToPaise(unitPrice * item.quantity + itemGstAmount);
          return {
            productId: item.productId,
            variantId: item.variantId ?? null,
            variantLabel: item.variant?.label ?? null,
            variantSku: (item.variant as any)?.sku ?? null,
            quantity: item.quantity,
            unitPrice,
            gstRate: item.product.gstRate,
            gstAmount: itemGstAmount,
            total: itemTotal,
          };
        }),
      },
    },
  });

  // Clear cart
  await prisma.cartItem.deleteMany({ where: { cartId: cart.id } });

  return NextResponse.json({ order });
}
