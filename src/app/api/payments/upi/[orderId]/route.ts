import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { getCurrentUserId } from "@/lib/auth/current-user";

const STAFF_ROLES = ["ADMIN", "SUPER_ADMIN", "ACCOUNTS"];

export async function GET(req: NextRequest, props: { params: Promise<{ orderId: string }> }) {
  const params = await props.params;
  const userId = await getCurrentUserId(req);
  if (!userId) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const authUser = await prisma.user.findUnique({ where: { id: userId }, select: { role: true } });
  if (!authUser) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  // A missing dealerFilter previously meant "no scoping at all" for any
  // authenticated non-DEALER role (VENDOR/STAFF/SALES/... all hold valid
  // NextAuth sessions) — that let any logged-in account read any dealer's
  // UPI/bank payment details by guessing an orderId. Only DEALER (scoped to
  // their own order) and the accounts-facing staff roles may proceed.
  let dealerFilter: { dealerId: string } | null = null;
  if (authUser.role === "DEALER") {
    const dealer = await prisma.dealer.findUnique({ where: { userId } });
    if (!dealer) return NextResponse.json({ error: "Forbidden" }, { status: 403 });
    dealerFilter = { dealerId: dealer.id };
  } else if (!STAFF_ROLES.includes(authUser.role)) {
    return NextResponse.json({ error: "Forbidden" }, { status: 403 });
  }

  const order = await prisma.order.findFirst({
    where: {
      id: params.orderId,
      ...(dealerFilter ?? {}),
    },
    include: {
      dealer: { include: { user: { select: { email: true, name: true } } } },
      items: { include: { product: { include: { productImages: { where: { isPrimary: true }, take: 1 } } } } },
      paymentSubmissions: { orderBy: { createdAt: "desc" }, take: 1 },
    },
  });

  if (!order) return NextResponse.json({ error: "Order not found." }, { status: 404 });

  const upiIdSetting = await prisma.setting.findUnique({ where: { key: "upi_id" } });
  const upiNameSetting = await prisma.setting.findUnique({ where: { key: "upi_name" } });
  const bankAccountSetting = await prisma.setting.findUnique({ where: { key: "bank_account_number" } });
  const bankIfscSetting = await prisma.setting.findUnique({ where: { key: "bank_ifsc" } });
  const bankNameSetting = await prisma.setting.findUnique({ where: { key: "bank_account_name" } });
  const upiEnabledSetting = await prisma.setting.findUnique({ where: { key: "upi_enabled" } });

  const paymentSettings = {
    upiId: upiIdSetting?.value || "5118678468276SB1024@mairtel",
    upiName: upiNameSetting?.value || "MotoXPlus India Private Limited",
    bankAccountNumber: bankAccountSetting?.value || "7834839071",
    bankIfsc: bankIfscSetting?.value || "AIRP0000001",
    bankAccountName: bankNameSetting?.value || "MotoXPlus India Private Limited",
    upiEnabled: upiEnabledSetting?.value !== "false",
  };

  return NextResponse.json({ order, paymentSettings });
}
