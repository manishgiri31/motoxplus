import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import crypto from "crypto";
import { generateInvoiceNumber } from "@/lib/utils";
import { createDelhiveryShipment } from "@/lib/delhivery";
import { getCurrentUserId } from "@/lib/auth/current-user";

export async function POST(req: NextRequest) {
  const userId = await getCurrentUserId(req);
  if (!userId) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }
  const authUser = await prisma.user.findUnique({ where: { id: userId }, select: { role: true } });
  if (!authUser || authUser.role !== "DEALER") {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const { razorpayOrderId, razorpayPaymentId, razorpaySignature, orderId } = await req.json();

  // Verify signature
  const expectedSignature = crypto
    .createHmac("sha256", process.env.RAZORPAY_KEY_SECRET!)
    .update(`${razorpayOrderId}|${razorpayPaymentId}`)
    .digest("hex");

  if (expectedSignature !== razorpaySignature) {
    return NextResponse.json({ error: "Invalid payment signature" }, { status: 400 });
  }

  // Get order
  const order = await prisma.order.findUnique({
    where: { id: orderId },
    include: { dealer: true, items: { include: { product: true } } },
  });

  if (!order) return NextResponse.json({ error: "Order not found" }, { status: 404 });

  // Ensure the order belongs to the requesting dealer
  const dealer = await prisma.dealer.findUnique({ where: { userId } });
  if (!dealer || order.dealerId !== dealer.id) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 403 });
  }

  // Update payment
  await prisma.payment.updateMany({
    where: { orderId, razorpayOrderId },
    data: {
      razorpayPaymentId,
      razorpaySignature,
      status: "PAID",
    },
  });

  // Update order
  const isFullPayment = order.paymentType === "FULL_100";
  await prisma.order.update({
    where: { id: orderId },
    data: {
      amountPaid: order.amountDue,
      amountDue: isFullPayment ? 0 : order.grandTotal - order.amountDue,
      paymentStatus: isFullPayment ? "PAID" : "PARTIAL",
      status: "CONFIRMED",
    },
  });

  // Generate invoice
  const invoiceNumber = generateInvoiceNumber();
  await prisma.invoice.create({
    data: {
      invoiceNumber,
      orderId,
      dealerId: order.dealerId,
      subtotal: order.subtotal,
      gstAmount: order.gstAmount,
      grandTotal: order.grandTotal,
    },
  });

  // Auto-create Delhivery shipment (fire-and-forget)
  createDelhiveryShipment(orderId).catch((err) => {
    console.error(`[Delhivery] Shipment creation failed for order ${orderId}:`, err);
  });

  return NextResponse.json({ success: true, invoiceNumber });
}
