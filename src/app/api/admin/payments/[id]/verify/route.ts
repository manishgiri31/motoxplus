import { NextRequest, NextResponse } from "next/server";
import { getServerSession } from "next-auth";
import { authOptions } from "@/lib/auth";
import { prisma } from "@/lib/prisma";
import { sendEmail } from "@/lib/email";
import { baseTemplate } from "@/lib/email/templates/base";
import { generateInvoiceNumber, escapeHtml } from "@/lib/utils";
import { decrementStock, InsufficientStockError } from "@/lib/orders/stock";

const ADMIN_ROLES = ["ADMIN", "SUPER_ADMIN", "STAFF"];

export async function POST(req: NextRequest, props: { params: Promise<{ id: string }> }) {
  const params = await props.params;
  const session = await getServerSession(authOptions);
  if (!session || !ADMIN_ROLES.includes(session.user.role)) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const { notes } = await req.json().catch(() => ({}));

  const submission = await prisma.paymentSubmission.findUnique({
    where: { id: params.id },
    include: {
      order: {
        include: {
          dealer: { include: { user: { select: { email: true } } } },
          invoice: true,
          items: true,
        },
      },
    },
  });

  if (!submission) return NextResponse.json({ error: "Submission not found." }, { status: 404 });
  if (submission.status === "VERIFIED") {
    return NextResponse.json({ error: "Already verified." }, { status: 409 });
  }

  const now = new Date();

  try {
    await prisma.$transaction(async (tx) => {
      // Mark submission verified
      await tx.paymentSubmission.update({
        where: { id: params.id },
        data: {
          status: "VERIFIED",
          verifiedAt: now,
          verifiedBy: session.user.id,
          notes: notes || null,
        },
      });

      // Update order: paid + confirmed. Guarded on stockReserved so this is
      // idempotent against a double-click / retried request — only the call
      // that actually flips the flag decrements stock, matching the pattern
      // used by the Razorpay verify and COD checkout paths (lib/orders/stock.ts).
      const guarded = await tx.order.updateMany({
        where: { id: submission.orderId, stockReserved: false },
        data: {
          paymentStatus: "PAID",
          amountPaid: submission.order.amountDue,
          amountDue: 0,
          status: submission.order.status === "PENDING" ? "CONFIRMED" : submission.order.status,
          stockReserved: true,
        },
      });

      if (guarded.count > 0) {
        await decrementStock(
          tx,
          submission.order.items.map((item) => ({
            productId: item.productId,
            variantId: item.variantId,
            quantity: item.quantity,
          }))
        );
      }

      // Generate invoice if not already created
      if (!submission.order.invoice) {
        await tx.invoice.create({
          data: {
            invoiceNumber: generateInvoiceNumber(),
            orderId: submission.orderId,
            dealerId: submission.dealerId,
            subtotal: submission.order.subtotal ?? 0,
            gstAmount: submission.order.gstAmount ?? 0,
            grandTotal: submission.order.grandTotal,
          },
        });
      }
    });
  } catch (err) {
    if (err instanceof InsufficientStockError) {
      return NextResponse.json(
        { error: "Cannot verify — one or more items on this order are no longer in stock. Adjust stock or contact the dealer before verifying." },
        { status: 409 }
      );
    }
    throw err;
  }

  // Reload the order with invoice for email
  const updatedOrder = await prisma.order.findUnique({
    where: { id: submission.orderId },
    include: { invoice: true, dealer: { include: { user: { select: { email: true } } } } },
  });

  // Notify dealer — sent to the dealer's own account email, not the
  // client-supplied payerEmail captured at submission time, and with all
  // submission-sourced fields HTML-escaped before interpolation.
  sendEmail({
    to: submission.order.dealer.user.email,
    subject: `Payment Verified — Order #${submission.order.orderNumber} | MOTOXPLUS`,
    html: baseTemplate("Payment Verified", `
      <div class="title">✓ Payment Verified</div>
      <p class="text">Hi ${escapeHtml(submission.payerName)},</p>
      <p class="text">Great news! Your payment for order <strong style="color:#fff;">#${submission.order.orderNumber}</strong> has been verified by our accounts team. Your order is now confirmed and will move to production.</p>
      <div class="otp-box" style="text-align:left;">
        <table style="width:100%;border-collapse:collapse;">
          <tr><td style="color:#6b7280;font-size:12px;padding:6px 0;">Order Number</td><td style="color:#fff;font-size:13px;font-weight:700;text-align:right;">#${submission.order.orderNumber}</td></tr>
          <tr><td style="color:#6b7280;font-size:12px;padding:6px 0;">Amount Verified</td><td style="color:#22c55e;font-size:13px;font-weight:700;text-align:right;">₹${submission.amount.toFixed(2)}</td></tr>
          <tr><td style="color:#6b7280;font-size:12px;padding:6px 0;">UTR</td><td style="color:#fff;font-size:13px;font-family:monospace;text-align:right;">${escapeHtml(submission.utrNumber)}</td></tr>
          <tr><td style="color:#6b7280;font-size:12px;padding:6px 0;">Invoice</td><td style="color:#fff;font-size:13px;text-align:right;">${updatedOrder?.invoice?.invoiceNumber || "—"}</td></tr>
        </table>
      </div>
      ${notes ? `<p class="small">Note from accounts: ${escapeHtml(String(notes))}</p>` : ""}
      <hr class="divider"/>
      <p class="small">A tax invoice has been generated. You can view and download it from your dealer portal. Your order will be dispatched as per the production schedule.</p>
    `),
  }).catch(() => {});

  return NextResponse.json({ message: "Payment verified. Order confirmed and invoice generated." });
}
