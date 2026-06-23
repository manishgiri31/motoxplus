import { NextRequest, NextResponse } from "next/server";
import { getServerSession } from "next-auth";
import { authOptions } from "@/lib/auth";
import { prisma } from "@/lib/prisma";

export async function GET(req: NextRequest, { params }: { params: { orderId: string } }) {
  const session = await getServerSession(authOptions);
  if (!session) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const dealer = session.user.role === "DEALER"
    ? await prisma.dealer.findUnique({ where: { userId: session.user.id } })
    : null;

  const order = await prisma.order.findFirst({
    where: {
      id: params.orderId,
      ...(dealer ? { dealerId: dealer.id } : {}),
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
