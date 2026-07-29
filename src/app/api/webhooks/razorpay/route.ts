import { NextRequest, NextResponse } from "next/server";
import crypto from "crypto";
import { prisma } from "@/lib/prisma";

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

interface RazorpayRefundEvent {
  event: string;
  payload?: {
    refund?: {
      entity?: {
        id?: string;
        error_description?: string | null;
      };
    };
  };
}

/**
 * Handles refund.processed / refund.failed events for the cancellation-charge
 * refunds initiated in POST /api/orders/[id]/cancel — moves
 * OrderCancellation.refundStatus INITIATED -> PROCESSED/FAILED and, on
 * success, moves Order.paymentStatus to REFUNDED.
 *
 * Payment-capture events (payment.captured / order.paid) are NOT handled
 * here — that flow stays client-driven via /api/payments/verify, which
 * already updates Order/Payment on the signed client callback. Only refunds
 * need a server-pushed webhook, since Razorpay processes them asynchronously
 * after the initial refund API call in the cancel route returns.
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

  let event: RazorpayRefundEvent;
  try {
    event = JSON.parse(rawBody);
  } catch {
    return NextResponse.json({ error: "Invalid payload" }, { status: 400 });
  }

  try {
    if (event.event === "refund.processed" || event.event === "refund.failed") {
      const refund = event.payload?.refund?.entity;
      if (!refund?.id) return NextResponse.json({ ok: true });

      const cancellation = await prisma.orderCancellation.findFirst({ where: { refundId: refund.id } });
      if (!cancellation) {
        // Not necessarily an error — could be a refund from a flow other than
        // order cancellation. Log and ack so Razorpay doesn't retry forever.
        console.warn(`[Razorpay Webhook] No OrderCancellation found for refund ${refund.id}`);
        return NextResponse.json({ ok: true });
      }

      const succeeded = event.event === "refund.processed";
      await prisma.$transaction([
        prisma.orderCancellation.update({
          where: { id: cancellation.id },
          data: {
            refundStatus: succeeded ? "PROCESSED" : "FAILED",
            refundedAt: succeeded ? new Date() : null,
            refundError: succeeded ? null : refund.error_description || "Refund failed",
          },
        }),
        ...(succeeded
          ? [prisma.order.update({ where: { id: cancellation.orderId }, data: { paymentStatus: "REFUNDED" as const } })]
          : []),
      ]);
    }

    return NextResponse.json({ ok: true });
  } catch (err) {
    console.error("[Razorpay Webhook] Processing error:", err);
    // Always 200 — same reasoning as the Delhivery webhook: prevent Razorpay
    // from retrying indefinitely on our bug rather than a real delivery failure.
    return NextResponse.json({ ok: false, error: "Processing failed" });
  }
}
