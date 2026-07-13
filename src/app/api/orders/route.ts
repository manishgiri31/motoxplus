import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { generateOrderNumber, generateInvoiceNumber } from "@/lib/utils";
import { createDelhiveryShipment } from "@/lib/delhivery";
import { getCurrentUserId } from "@/lib/auth/current-user";

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

  const dealer = await prisma.dealer.findUnique({ where: { userId } });
  if (!dealer) return NextResponse.json({ error: "Dealer not found" }, { status: 404 });

  const cart = await prisma.cart.findUnique({
    where: { dealerId: dealer.id },
    include: { items: { include: { product: true, variant: true } } },
  });

  if (!cart || cart.items.length === 0) {
    return NextResponse.json({ error: "Cart is empty" }, { status: 400 });
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

  const isCOD = paymentType === "COD";
  const shippingCost = calcShipping(subtotal + gstAmount);

  const grandTotal = subtotal + gstAmount + shippingCost;

  const amountDue =
    paymentType === "ADVANCE_20"
      ? grandTotal * 0.2
      : grandTotal;

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
      notes: isCOD ? `[COD ORDER] ${notes || ""}`.trim() : notes,
      status: isCOD ? "CONFIRMED" : "PENDING",
      paymentStatus: isCOD ? "PENDING" : "PENDING",
      shippingAddress: deliveryAddress,
      deliveryName: deliveryName || dealer.ownerName,
      deliveryPhone: deliveryPhone || dealer.phone,
      deliveryCity: deliveryCity || dealer.city,
      deliveryState: deliveryState || dealer.state,
      deliveryPincode,
      items: {
        create: cart.items.map((item) => {
          const unitPrice = item.variant?.price ?? item.product.price;
          return {
            productId: item.productId,
            variantId: item.variantId ?? null,
            variantLabel: item.variant?.label ?? null,
            variantSku: (item.variant as any)?.sku ?? null,
            quantity: item.quantity,
            unitPrice,
            gstRate: item.product.gstRate,
            gstAmount: (unitPrice * item.quantity * item.product.gstRate) / 100,
            total: unitPrice * item.quantity * (1 + item.product.gstRate / 100),
          };
        }),
      },
    },
  });

  // COD: generate invoice immediately
  if (isCOD) {
    await prisma.invoice.create({
      data: {
        invoiceNumber: generateInvoiceNumber(),
        orderId: order.id,
        dealerId: dealer.id,
        subtotal,
        gstAmount,
        grandTotal,
      },
    });
  }

  // Clear cart
  await prisma.cartItem.deleteMany({ where: { cartId: cart.id } });

  // COD: auto-create Delhivery shipment (fire-and-forget, don't block response)
  if (isCOD) {
    createDelhiveryShipment(order.id).catch((err) => {
      console.error(`[Delhivery] COD shipment creation failed for order ${order.id}:`, err);
    });
  }

  return NextResponse.json({ order, isCOD });
}
