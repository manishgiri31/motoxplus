import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import crypto from "crypto";
import { getCurrentUserId } from "@/lib/auth/current-user";
import { getVerifiedDealer, ACCOUNT_NOT_VERIFIED_MESSAGE } from "@/lib/auth/verified-account";
import { getRazorpay } from "@/lib/razorpay";
import { InsufficientStockError } from "@/lib/orders/stock";
import { finalizeCapturedPayment } from "@/lib/payments/finalize";

// Same flag /api/payments/create-order enforces — the frontend hiding the
// Razorpay options is not an authorization control, so this endpoint must
// also reject directly if the feature is disabled (there would be no Payment
// row to match against anyway, but this fails fast with a clearer error).
const RAZORPAY_ENABLED = process.env.NEXT_PUBLIC_RAZORPAY_ENABLED === "true";

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
  if (!RAZORPAY_ENABLED) {
    return NextResponse.json({ error: "Online payment is not available right now." }, { status: 400 });
  }

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

    // Get order (dealer/items are re-fetched by finalizeCapturedPayment as needed)
    const order = await prisma.order.findUnique({ where: { id: orderId } });

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

    // Marks the Payment PAID and, exactly once (guarded on
    // Order.stockReserved), transitions the order, decrements stock, creates
    // the invoice, and kicks off the Delhivery shipment. Shared with the
    // payment.captured/order.paid webhook so a retried verify call and a
    // webhook delivery for the same payment can never double-process —
    // whichever arrives first wins, the other is a safe no-op.
    const { invoiceNumber } = await finalizeCapturedPayment({
      paymentId: payment.id,
      orderId,
      razorpayPaymentId,
      razorpaySignature,
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
