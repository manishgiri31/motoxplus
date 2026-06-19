import { NextRequest, NextResponse } from "next/server";
import { getServerSession } from "next-auth";
import { authOptions } from "@/lib/auth";
import { prisma } from "@/lib/prisma";
import crypto from "crypto";
import { generateInvoiceNumber } from "@/lib/utils";
import { createDelhiveryShipment } from "@/lib/delhivery";

export async function POST(req: NextRequest) {
  const session = await getServerSession(authOptions);
  if (!session || session.user.role !== "DEALER") {
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
  const invoice = await prisma.invoice.create({
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
