import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { getCurrentUserId } from "@/lib/auth/current-user";
import { UPI_SETTING_KEYS, buildOrderPaymentSettings, isUpiFlagEnabled } from "@/lib/payments/upi-settings";

const STAFF_ROLES = ["ADMIN", "SUPER_ADMIN", "ACCOUNTS"];

export async function GET(req: NextRequest, props: { params: Promise<{ orderId: string }> }) {
  const params = await props.params;
  const userId = await getCurrentUserId(req);
  if (!userId) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const authUser = await prisma.user.findUnique({ where: { id: userId }, select: { role: true } });
  if (!authUser) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  // A missing ownerFilter previously meant "no scoping at all" for any
  // authenticated non-DEALER role (VENDOR/STAFF/SALES/... all hold valid
  // NextAuth sessions) — that let any logged-in account read any dealer's
  // UPI/bank payment details by guessing an orderId. Only DEALER/CUSTOMER
  // (scoped to their own order) and the accounts-facing staff roles may
  // proceed.
  let ownerFilter: { dealerId: string } | { customerId: string } | null = null;
  if (authUser.role === "DEALER") {
    const dealer = await prisma.dealer.findUnique({ where: { userId } });
    if (!dealer) return NextResponse.json({ error: "Forbidden" }, { status: 403 });
    ownerFilter = { dealerId: dealer.id };
  } else if (authUser.role === "CUSTOMER") {
    const customer = await prisma.customer.findUnique({ where: { userId } });
    if (!customer) return NextResponse.json({ error: "Forbidden" }, { status: 403 });
    ownerFilter = { customerId: customer.id };
  } else if (!STAFF_ROLES.includes(authUser.role)) {
    return NextResponse.json({ error: "Forbidden" }, { status: 403 });
  }

  const order = await prisma.order.findFirst({
    where: {
      id: params.orderId,
      ...(ownerFilter ?? {}),
    },
    include: {
      dealer: { include: { user: { select: { email: true, name: true } } } },
      customer: { include: { user: { select: { email: true, name: true } } } },
      items: { include: { product: { include: { productImages: { where: { isPrimary: true }, take: 1 } } } } },
      paymentSubmissions: { orderBy: { createdAt: "desc" }, take: 1 },
    },
  });

  if (!order) return NextResponse.json({ error: "Order not found." }, { status: 404 });

  const settingRows = await prisma.setting.findMany({ where: { key: { in: [...UPI_SETTING_KEYS] } } });
  const settingMap: Record<string, string> = {};
  for (const s of settingRows) settingMap[s.key] = s.value;

  // No fallback payee/bank values: anything not configured comes back as null
  // plus a message the pay-upi page shows (HTTP 200 so the page can render it).
  // upi_enabled is opt-in everywhere (see isUpiFlagEnabled).
  const paymentSettings = buildOrderPaymentSettings(settingMap, isUpiFlagEnabled(settingMap));

  return NextResponse.json({ order, paymentSettings });
}
