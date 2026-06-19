import { NextRequest, NextResponse } from "next/server";
import { getServerSession } from "next-auth";
import { authOptions } from "@/lib/auth";
import { prisma } from "@/lib/prisma";
import { generateOrderNumber, generateInvoiceNumber } from "@/lib/utils";
import { calculateShippingRate, calculateOrderWeight, createDelhiveryShipment } from "@/lib/delhivery";

const ORIGIN_PINCODE = process.env.DELHIVERY_ORIGIN_PINCODE || "110046";

export async function GET(req: NextRequest) {
  const session = await getServerSession(authOptions);
  if (!session) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const { searchParams } = new URL(req.url);
  const page = parseInt(searchParams.get("page") || "1");
  const pageSize = 10;

  if (session.user.role === "DEALER") {
    const dealer = await prisma.dealer.findUnique({ where: { userId: session.user.id } });
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

  if (session.user.role === "ADMIN" || session.user.role === "SUPER_ADMIN") {
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
  const session = await getServerSession(authOptions);
  if (!session || session.user.role !== "DEALER") {
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
  } = await req.json();

  if (!paymentType || !["ADVANCE_20", "FULL_100", "COD"].includes(paymentType)) {
    return NextResponse.json({ error: "Invalid payment type" }, { status: 400 });
  }

  if (!deliveryPincode || !/^\d{6}$/.test(deliveryPincode)) {
    return NextResponse.json({ error: "Valid delivery pincode is required" }, { status: 400 });
  }

  const dealer = await prisma.dealer.findUnique({ where: { userId: session.user.id } });
  if (!dealer) return NextResponse.json({ error: "Dealer not found" }, { status: 404 });

  const cart = await prisma.cart.findUnique({
    where: { dealerId: dealer.id },
    include: { items: { include: { product: true } } },
  });

  if (!cart || cart.items.length === 0) {
    return NextResponse.json({ error: "Cart is empty" }, { status: 400 });
  }

  let subtotal = 0;
  let gstAmount = 0;

  for (const item of cart.items) {
    const itemSubtotal = item.product.price * item.quantity;
    const itemGST = (itemSubtotal * item.product.gstRate) / 100;
    subtotal += itemSubtotal;
    gstAmount += itemGST;
  }

  // Calculate shipping cost
  const weightKg = calculateOrderWeight(cart.items);
  const isCOD = paymentType === "COD";

  const shippingResult = await calculateShippingRate({
    originPincode: ORIGIN_PINCODE,
    destinationPincode: deliveryPincode,
    weightKg,
    paymentMode: isCOD ? "COD" : "Prepaid",
    codAmount: isCOD ? subtotal + gstAmount : undefined,
  }).catch(() => ({ shippingCost: 0, source: "default" as const }));

  const shippingCost = shippingResult.shippingCost;
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
        create: cart.items.map((item) => ({
          productId: item.productId,
          quantity: item.quantity,
          unitPrice: item.product.price,
          gstRate: item.product.gstRate,
          gstAmount: (item.product.price * item.quantity * item.product.gstRate) / 100,
          total: item.product.price * item.quantity * (1 + item.product.gstRate / 100),
        })),
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
