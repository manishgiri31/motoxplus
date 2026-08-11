import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import crypto from "crypto";
import { generateInvoiceNumber, roundToPaise } from "@/lib/utils";
import { createDelhiveryShipment } from "@/lib/delhivery";
import { getCurrentUserId } from "@/lib/auth/current-user";
import { getVerifiedDealer, ACCOUNT_NOT_VERIFIED_MESSAGE } from "@/lib/auth/verified-account";
import { getRazorpay } from "@/lib/razorpay";
import { decrementStock, InsufficientStockError } from "@/lib/orders/stock";

// Same timing-safe-compare approach as the Razorpay/Delhivery webhooks
// (src/app/api/webhooks/*) — a plain === leaks match length via timing.
function signatureMatches(orderId: string, paymentId: string, provided: string, secret: string): boolean {
  const expected = crypto.createHmac("sha256", secret).update(`${orderId}|${paymentId}`).digest("hex");
  const a = Buffer.from(provided);
  const b = Buffer.from(expected);
  if (a.length !== b.length) return false;
  return crypto.timingSafeEqual(a, b);
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

  const { razorpayOrderId, razorpayPaymentId, razorpaySignature, orderId } = await req.json();
  if (
    typeof razorpayOrderId !== "string" || !razorpayOrderId ||
    typeof razorpayPaymentId !== "string" || !razorpayPaymentId ||
    typeof razorpaySignature !== "string" || !razorpaySignature ||
    typeof orderId !== "string" || !orderId
  ) {
    return NextResponse.json({ error: "Invalid request" }, { status: 400 });
  }

  try {
    if (!signatureMatches(razorpayOrderId, razorpayPaymentId, razorpaySignature, process.env.RAZORPAY_KEY_SECRET!)) {
      return NextResponse.json({ error: "Invalid payment signature" }, { status: 400 });
    }

    // Get order
    const order = await prisma.order.findUnique({
      where: { id: orderId },
      include: { dealer: true, items: { include: { product: true } } },
    });

    if (!order) return NextResponse.json({ error: "Order not found" }, { status: 404 });

    // Ensure the order belongs to the requesting dealer, and that the
    // account is still verified/approved (not just holding a valid session).
    const dealer = await getVerifiedDealer(userId);
    if (!dealer) {
      return NextResponse.json({ error: ACCOUNT_NOT_VERIFIED_MESSAGE }, { status: 403 });
    }
    if (order.dealerId !== dealer.id) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 403 });
    }

    // The HMAC above only proves razorpayOrderId and razorpayPaymentId are
    // authentically paired with each other — it says nothing about which of
    // OUR orders they're for. Without this lookup, a dealer could legitimately
    // pay a cheap order (getting a genuinely valid signature for that
    // razorpayOrderId/razorpayPaymentId pair) and replay it here against a
    // different, expensive `orderId` of theirs: the code below would then mark
    // the expensive order PAID for its full amountDue on the strength of a
    // signature that only ever certified a much smaller payment. Requiring a
    // pre-existing Payment row created by /api/payments/create-order (whose
    // `amount` is server-computed from order.amountDue, never client input)
    // for this exact (orderId, razorpayOrderId) pair closes that gap.
    const payment = await prisma.payment.findFirst({ where: { orderId, razorpayOrderId } });
    if (!payment) {
      console.error(
        `[Payments] verify: no Payment row for orderId=${orderId} razorpayOrderId=${razorpayOrderId} — possible replay (userId=${userId})`
      );
      return NextResponse.json({ error: "Payment record not found for this order" }, { status: 400 });
    }

    // Confirm directly with Razorpay that this payment was actually captured,
    // for the order/amount/currency we expect. The signature alone proves
    // authenticity of the pair, not that the captured amount matches what
    // THIS order is due — this is the second, independent check.
    const expectedAmountPaise = Math.round(payment.amount * 100);
    let captured;
    try {
      captured = await getRazorpay().payments.fetch(razorpayPaymentId);
    } catch (err) {
      console.error(`[Payments] verify: Razorpay payments.fetch failed for ${razorpayPaymentId}:`, err);
      return NextResponse.json({ error: "Unable to confirm payment with Razorpay. Please contact support." }, { status: 502 });
    }
    if (
      captured.status !== "captured" ||
      captured.order_id !== razorpayOrderId ||
      captured.amount !== expectedAmountPaise ||
      captured.currency !== "INR"
    ) {
      console.error(
        `[Payments] verify: capture mismatch orderId=${orderId} status=${captured.status} amount=${captured.amount} expected=${expectedAmountPaise} currency=${captured.currency} (userId=${userId})`
      );
      return NextResponse.json({ error: "Payment could not be verified. Please contact support." }, { status: 400 });
    }

    // Update payment
    await prisma.payment.update({
      where: { id: payment.id },
      data: {
        razorpayPaymentId,
        razorpaySignature,
        status: "PAID",
      },
    });

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

    if (!invoiceNumber) {
      // Already processed by an earlier call to this endpoint — look up the
      // invoice that call created instead of making a second one.
      const existing = await prisma.invoice.findUnique({ where: { orderId } });
      invoiceNumber = existing?.invoiceNumber ?? null;
    }

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
