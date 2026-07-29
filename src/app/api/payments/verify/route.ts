import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import crypto from "crypto";
import { generateInvoiceNumber, roundToPaise } from "@/lib/utils";
import { createDelhiveryShipment } from "@/lib/delhivery";
import { getCurrentUserId } from "@/lib/auth/current-user";
import { paymentDebug } from "@/lib/payment-debug"; // TODO(remove-before-prod)
import { decrementStock, InsufficientStockError } from "@/lib/orders/stock";

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
  paymentDebug("verify: request received", { orderId, razorpayOrderId, razorpayPaymentId, userId }); // TODO(remove-before-prod)

  try {
    // Verify signature
    const expectedSignature = crypto
      .createHmac("sha256", process.env.RAZORPAY_KEY_SECRET!)
      .update(`${razorpayOrderId}|${razorpayPaymentId}`)
      .digest("hex");

    const signatureValid = expectedSignature === razorpaySignature;
    paymentDebug("verify: signature check", { orderId, razorpayOrderId, signatureValid }); // TODO(remove-before-prod)

    if (!signatureValid) {
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
    paymentDebug("verify: Payment row marked PAID", { orderId, razorpayOrderId }); // TODO(remove-before-prod)

    // Update order
    const isFullPayment = order.paymentType === "FULL_100";
    await prisma.order.update({
      where: { id: orderId },
      data: {
        amountPaid: order.amountDue,
        amountDue: isFullPayment ? 0 : roundToPaise(order.grandTotal - order.amountDue),
        paymentStatus: isFullPayment ? "PAID" : "PARTIAL",
        status: "CONFIRMED",
      },
    });
    paymentDebug("verify: Order marked CONFIRMED", { orderId, paymentStatus: isFullPayment ? "PAID" : "PARTIAL" }); // TODO(remove-before-prod)

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
    paymentDebug("verify: Invoice generated, returning success to client", { orderId, invoiceNumber }); // TODO(remove-before-prod)

    // Auto-create Delhivery shipment (fire-and-forget)
    createDelhiveryShipment(orderId).catch((err) => {
      console.error(`[Delhivery] Shipment creation failed for order ${orderId}:`, err);
    });

    return NextResponse.json({ success: true, invoiceNumber });
  } catch (err) {
    // Money was very possibly already captured by Razorpay by the time we get
    // here — log loudly rather than letting this fall through as a generic
    // unhandled 500 with nothing to grep for.
    console.error(`[Payments] verify failed after Razorpay capture — orderId=${orderId} razorpayOrderId=${razorpayOrderId}:`, err);
    paymentDebug("verify: FAILED", { orderId, razorpayOrderId, error: err instanceof Error ? err.message : String(err) }); // TODO(remove-before-prod)
    return NextResponse.json({ error: "Payment verification failed. Please contact support." }, { status: 500 });
  }
}
