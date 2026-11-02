import { NextRequest, NextResponse } from "next/server";
import { getServerSession } from "next-auth";
import { authOptions } from "@/lib/auth";
import { toWhatsAppPhone } from "@/lib/phone";
import { sendTemplate } from "@/lib/whatsapp/send-template";
import {
  ORDER_TEMPLATES,
  buildTemplateValues,
  loadOrderForWhatsApp,
  type OrderWhatsAppEvent,
} from "@/lib/whatsapp/order-notifications";

const EVENTS: OrderWhatsAppEvent[] = ["ORDER_CONFIRMED", "ORDER_CANCELLED", "ORDER_SHIPPED"];

/**
 * Dev-only manual test: sends order_confirmed, order_cancelled and
 * order_shipped for one real order, one after another, and reports each
 * result.
 *
 *   POST /api/dev/whatsapp-order-test   (signed in as an admin)
 *   { "orderId": "<Order.id>", "phone": "9876543210" }
 *
 * Pass `phone` to send to your own number instead of the order's customer —
 * strongly recommended, since these are real messages. Bypasses the
 * Order.*NotifiedAt flags and WHATSAPP_ORDER_NOTIFICATIONS (and never sets the
 * flags), so it can be re-run freely and doesn't consume the real
 * notifications. Needs WHATSAPP_ACCESS_TOKEN / WHATSAPP_PHONE_NUMBER_ID.
 *
 * 404s outside NODE_ENV=development. `next dev` here binds 0.0.0.0, so it also
 * requires an admin session rather than trusting the network.
 */
export async function POST(req: NextRequest) {
  if (process.env.NODE_ENV !== "development") return new NextResponse(null, { status: 404 });

  const session = await getServerSession(authOptions);
  if (!session || !["ADMIN", "SUPER_ADMIN"].includes(session.user.role)) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const { orderId, phone: phoneOverride } = await req.json().catch(() => ({}));
  if (typeof orderId !== "string" || !orderId) {
    return NextResponse.json({ error: "orderId is required" }, { status: 400 });
  }

  const order = await loadOrderForWhatsApp(orderId);
  if (!order) return NextResponse.json({ error: "Order not found" }, { status: 404 });

  const phone = toWhatsAppPhone(phoneOverride ?? order.deliveryPhone);
  if (!phone) return NextResponse.json({ error: "No valid phone number — pass `phone`" }, { status: 400 });

  const results: Array<{ template: string; sent: boolean; messageId?: string; error?: string }> = [];
  for (const event of EVENTS) {
    const template = ORDER_TEMPLATES[event];
    try {
      const values = await buildTemplateValues(order, event);
      const { messageId } = await sendTemplate(phone, template, values);
      results.push({ template, sent: true, messageId });
    } catch (err) {
      results.push({ template, sent: false, error: err instanceof Error ? err.message : "unknown" });
    }
  }

  return NextResponse.json({ orderNumber: order.orderNumber, results });
}
