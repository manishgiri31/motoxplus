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

    // Update order, reserve stock, and generate the invoice atomically. The
    // `stockReserved: false` guard makes this idempotent against a retried
    // verify call (network retry, duplicate webhook): only the call that
    // actually flips the flag decrements stock / creates the invoice, so a
    // repeat call is a safe no-op instead of double-decrementing.
    const isFullPayment = order.paymentType === "FULL_100";
    let invoiceNumber: string | null = null;
    await prisma.$transaction(async (tx) => {
      const guarded = await tx.order.updateMany({
        where: { id: orderId, stockReserved: false },
        data: {
          amountPaid: order.amountDue,
          amountDue: isFullPayment ? 0 : roundToPaise(order.grandTotal - order.amountDue),
          paymentStatus: isFullPayment ? "PAID" : "PARTIAL",
          status: "CONFIRMED",
          stockReserved: true,
        },
      });
      if (guarded.count === 0) return;

      await decrementStock(
        tx,
        order.items.map((item) => ({
          productId: item.productId,
          variantId: item.variantId,
          quantity: item.quantity,
        }))
      );

      invoiceNumber = generateInvoiceNumber();
      await tx.invoice.create({
        data: {
          invoiceNumber,
          orderId,
          dealerId: order.dealerId,
          subtotal: order.subtotal,
          gstAmount: order.gstAmount,
          grandTotal: order.grandTotal,
        },
      });
    });
    paymentDebug("verify: Order marked CONFIRMED", { orderId, paymentStatus: isFullPayment ? "PAID" : "PARTIAL" }); // TODO(remove-before-prod)

    if (!invoiceNumber) {
      // Already processed by an earlier call to this endpoint — look up the
      // invoice that call created instead of making a second one.
      const existing = await prisma.invoice.findUnique({ where: { orderId } });
      invoiceNumber = existing?.invoiceNumber ?? null;
    }
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
    if (err instanceof InsufficientStockError) {
      return NextResponse.json(
        {
          error:
            "Your payment was received, but one or more items just went out of stock. Your payment is safe — please contact support with your order number to resolve this.",
        },
        { status: 409 }
      );
    }
    return NextResponse.json({ error: "Payment verification failed. Please contact support." }, { status: 500 });
  }
}
