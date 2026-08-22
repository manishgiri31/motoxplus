import { NextRequest, NextResponse } from "next/server";
import crypto from "crypto";
import { prisma } from "@/lib/prisma";
import { finalizeCapturedPayment } from "@/lib/payments/finalize";

const WEBHOOK_SECRET = process.env.RAZORPAY_WEBHOOK_SECRET;

// Same timing-safe-compare approach as the Delhivery webhook (src/app/api/webhooks/delhivery/route.ts),
// but Razorpay signs the raw body (HMAC-SHA256) rather than using a query-param token.
function signatureMatches(rawBody: string, provided: string | null, secret: string): boolean {
  if (!provided) return false;
  const expected = crypto.createHmac("sha256", secret).update(rawBody).digest("hex");
  const a = Buffer.from(provided);
  const b = Buffer.from(expected);
  if (a.length !== b.length) return false;
  return crypto.timingSafeEqual(a, b);
}

interface RazorpayPaymentEntity {
  id?: string;
  order_id?: string;
  status?: string;
  amount?: number;
  currency?: string;
  error_code?: string;
  error_description?: string;
}

interface RazorpayWebhookEvent {
  event: string;
  payload?: {
    payment?: { entity?: RazorpayPaymentEntity };
    refund?: {
      entity?: {
        id?: string;
        error_description?: string | null;
      };
    };
  };
}

/**
 * Server-side safety net for the payment-capture flow: if a customer pays and
 * Razorpay captures the money but the browser never calls /api/payments/verify
 * (crash, closed tab, network drop right after payment), this webhook is the
 * only remaining path that can still mark the order paid. It shares
 * finalizeCapturedPayment with /api/payments/verify, so whichever of the two
 * runs first performs the transition (guarded on Order.stockReserved) and the
 * other is a no-op — no double stock decrement, invoice, or shipment.
 *
 * Also handles refund.processed / refund.failed for the cancellation-charge
 * refunds initiated in POST /api/orders/[id]/cancel — moves
 * OrderCancellation.refundStatus INITIATED -> PROCESSED/FAILED and, on
 * success, moves Order.paymentStatus to REFUNDED.
 */
export async function POST(req: NextRequest) {
  const rawBody = await req.text();

  if (!WEBHOOK_SECRET) {
    if (process.env.NODE_ENV === "production") {
      console.error("[Razorpay Webhook] RAZORPAY_WEBHOOK_SECRET is not set — rejecting request");
      return NextResponse.json({ error: "Webhook not configured" }, { status: 503 });
    }
    console.warn("[Razorpay Webhook] Secret not set — skipping signature verification (dev only)");
  } else {
    const signature = req.headers.get("x-razorpay-signature");
    if (!signatureMatches(rawBody, signature, WEBHOOK_SECRET)) {
      console.warn("[Razorpay Webhook] Invalid signature");
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }
  }

  let event: RazorpayWebhookEvent;
  try {
    event = JSON.parse(rawBody);
  } catch {
    return NextResponse.json({ error: "Invalid payload" }, { status: 400 });
  }

  try {
    switch (event.event) {
      case "payment.captured":
      case "order.paid":
        await handlePaymentCaptured(event.payload?.payment?.entity);
        break;
      case "payment.failed":
        await handlePaymentFailed(event.payload?.payment?.entity);
        break;
      case "refund.processed":
      case "refund.failed":
        await handleRefundEvent(event.event, event.payload?.refund?.entity);
        break;
      default:
        // Unhandled event types are acked, not errors — Razorpay sends many
        // event types this integration doesn't act on.
        break;
    }

    return NextResponse.json({ ok: true });
  } catch (err) {
    console.error("[Razorpay Webhook] Processing error:", err);
    // Always 200 — same reasoning as the Delhivery webhook: prevent Razorpay
    // from retrying indefinitely on our bug rather than a real delivery failure.
    return NextResponse.json({ ok: false, error: "Processing failed" });
  }
}

async function handlePaymentCaptured(payment: RazorpayPaymentEntity | undefined) {
  if (!payment?.id || !payment.order_id) return;

  const dbPayment = await prisma.payment.findFirst({ where: { razorpayOrderId: payment.order_id } });
  if (!dbPayment) {
    // No Payment row for this Razorpay order — every Razorpay order in this
    // app is created by /api/payments/create-order, which always creates one
    // first, so this shouldn't happen. Log and ack rather than erroring so
    // Razorpay doesn't retry forever on something we can never resolve.
    console.warn(`[Razorpay Webhook] payment.captured: no Payment row for razorpayOrderId=${payment.order_id}`);
    return;
  }

  // Already processed (by /verify or an earlier delivery of this same
  // webhook) — skip re-running the transaction/shipment logic entirely.
  if (dbPayment.status === "PAID") return;

  // Don't blindly trust the payload — same three checks /api/payments/verify
  // makes against its independent Razorpay fetch, applied here against the
  // webhook's own (signature-verified) payment entity.
  const expectedAmountPaise = Math.round(dbPayment.amount * 100);
  if (payment.status !== "captured" || payment.amount !== expectedAmountPaise || payment.currency !== "INR") {
    console.error(
      `[Razorpay Webhook] payment.captured: mismatch for orderId=${dbPayment.orderId} status=${payment.status} amount=${payment.amount} expected=${expectedAmountPaise} currency=${payment.currency}`
    );
    return;
  }

  await finalizeCapturedPayment({
    paymentId: dbPayment.id,
    orderId: dbPayment.orderId,
    razorpayPaymentId: payment.id,
  });
}

async function handlePaymentFailed(payment: RazorpayPaymentEntity | undefined) {
  if (!payment?.id || !payment.order_id) return;

  const dbPayment = await prisma.payment.findFirst({ where: { razorpayOrderId: payment.order_id } });
  if (!dbPayment) return;

  // Never downgrade a payment that's already succeeded (e.g. a stale/
  // out-of-order failed-event delivery arriving after capture).
  const guarded = await prisma.payment.updateMany({
    where: { id: dbPayment.id, status: { not: "PAID" } },
    data: { status: "FAILED", razorpayPaymentId: payment.id },
  });
  if (guarded.count === 0) return;

  console.warn(
    `[Razorpay Webhook] payment.failed: orderId=${dbPayment.orderId} paymentId=${payment.id} code=${payment.error_code} desc=${payment.error_description}`
  );

  // Payment.status has no field for storing the failure reason — record it
  // on OrderEvent (already a free-text audit trail) so support has something
  // to look at without needing schema changes.
  await prisma.orderEvent.create({
    data: {
      orderId: dbPayment.orderId,
      type: "PAYMENT_FAILED",
      reason: payment.error_description || payment.error_code || "Payment failed",
    },
  });
}

async function handleRefundEvent(eventName: string, refund: { id?: string; error_description?: string | null } | undefined) {
  if (!refund?.id) return;

  const cancellation = await prisma.orderCancellation.findFirst({ where: { refundId: refund.id } });
  if (!cancellation) {
    // Not necessarily an error — could be a refund from a flow other than
    // order cancellation. Log and ack so Razorpay doesn't retry forever.
    console.warn(`[Razorpay Webhook] No OrderCancellation found for refund ${refund.id}`);
    return;
  }

  const succeeded = eventName === "refund.processed";

  // Razorpay retries webhooks on anything but a fast 2xx, and the same
  // event can legitimately arrive twice. Guard on refundStatus still
  // being INITIATED (same updateMany-guard pattern as the payment/cancel
  // routes) so a replayed or duplicate delivery is a no-op instead of
  // re-firing the Order.paymentStatus update a second time.
  const guarded = await prisma.orderCancellation.updateMany({
    where: { id: cancellation.id, refundStatus: "INITIATED" },
    data: {
      refundStatus: succeeded ? "PROCESSED" : "FAILED",
      refundedAt: succeeded ? new Date() : null,
      refundError: succeeded ? null : refund.error_description || "Refund failed",
    },
  });

  if (guarded.count > 0 && succeeded) {
    await prisma.order.update({ where: { id: cancellation.orderId }, data: { paymentStatus: "REFUNDED" } });
  }
}
