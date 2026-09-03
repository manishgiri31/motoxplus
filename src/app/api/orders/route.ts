import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { generateOrderNumber, generateInvoiceNumber, roundToPaise } from "@/lib/utils";
import { autoCreateShipment } from "@/lib/delhivery";
import { getCurrentUserId } from "@/lib/auth/current-user";
import { getVerifiedDealer, ACCOUNT_NOT_VERIFIED_MESSAGE } from "@/lib/auth/verified-account";
import { decrementStock, InsufficientStockError } from "@/lib/orders/stock";
import { enforceRateLimit, rejectOversizedBody } from "@/lib/auth/rate-limit-budgets";
import { notifyOrderEvent } from "@/lib/push/order-notifications";

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

  if (!paymentType || !["ADVANCE_20", "FULL_100", "COD"].includes(paymentType)) {
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

  const isCOD = paymentType === "COD";
  const shippingCost = calcShipping(subtotal + gstAmount);

  const grandTotal = roundToPaise(subtotal + gstAmount + shippingCost);

  const amountDue = roundToPaise(
    paymentType === "ADVANCE_20" ? grandTotal * 0.2 : grandTotal
  );

  let order;
  try {
    order = await prisma.$transaction(async (tx) => {
      const created = await tx.order.create({
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
          notes: isCOD ? `[COD ORDER] ${notes || ""}`.trim() : notes,
          status: isCOD ? "CONFIRMED" : "PENDING",
          paymentStatus: isCOD ? "PENDING" : "PENDING",
          // COD orders are created already CONFIRMED, so stock is reserved
          // immediately; prepaid orders reserve it later, at payment
          // confirmation (see payments/verify and admin/payments/verify).
          stockReserved: isCOD,
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

      if (isCOD) {
        await decrementStock(
          tx,
          cart.items.map((item) => ({
            productId: item.productId,
            variantId: item.variantId ?? null,
            quantity: item.quantity,
          }))
        );

        await tx.invoice.create({
          data: {
            invoiceNumber: generateInvoiceNumber(),
            orderId: created.id,
            dealerId: dealer.id,
            subtotal,
            gstAmount,
            grandTotal,
          },
        });
      }

      return created;
    });
  } catch (err) {
    if (err instanceof InsufficientStockError) {
      return NextResponse.json(
        { error: "Some items in your cart are no longer available in the requested quantity. Please update your cart." },
        { status: 409 }
      );
    }
    throw err;
  }

  // Clear cart
  await prisma.cartItem.deleteMany({ where: { cartId: cart.id } });

  // COD orders are born CONFIRMED — auto-create the Delhivery shipment and
  // notify the dealer, exactly as the prepaid path does once payment lands.
  // Both are fire-and-forget: a Delhivery outage must never fail order
  // placement. autoCreateShipment is gated by DELHIVERY_AUTO_SHIPMENT, records
  // its outcome on OrderEvent, and is idempotent (advisory lock in
  // createDelhiveryShipment).
  if (isCOD) {
    void autoCreateShipment(order.id);
    void notifyOrderEvent(order.id, "ORDER_CONFIRMED");
  }

  return NextResponse.json({ order, isCOD });
}
