import { NextRequest, NextResponse } from "next/server";
import { getServerSession } from "next-auth";
import { authOptions } from "@/lib/auth";
import { prisma } from "@/lib/prisma";

const ADMIN_ROLES = ["ADMIN", "SUPER_ADMIN"];

const UPI_KEYS = ["upi_id", "upi_name", "upi_enabled", "bank_account_name", "bank_account_number", "bank_ifsc", "bank_account_type"];

export async function GET() {
  const settings = await prisma.setting.findMany({ where: { key: { in: UPI_KEYS } } });
  const map: Record<string, string> = {};
  for (const s of settings) map[s.key] = s.value;
  return NextResponse.json({
    upiId: map.upi_id || "5118678468276SB1024@mairtel",
    upiName: map.upi_name || "MotoXPlus India Private Limited",
    upiEnabled: map.upi_enabled !== "false",
    bankAccountName: map.bank_account_name || "MotoXPlus India Private Limited",
    bankAccountNumber: map.bank_account_number || "7834839071",
    bankIfsc: map.bank_ifsc || "AIRP0000001",
    bankAccountType: map.bank_account_type || "Current",
  });
}

export async function POST(req: NextRequest) {
  const session = await getServerSession(authOptions);
  if (!session || !ADMIN_ROLES.includes(session.user.role)) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const body = await req.json();
  const updates: { key: string; value: string }[] = [];

  const fieldMap: Record<string, string> = {
    upiId: "upi_id",
    upiName: "upi_name",
    upiEnabled: "upi_enabled",
    bankAccountName: "bank_account_name",
    bankAccountNumber: "bank_account_number",
    bankIfsc: "bank_ifsc",
    bankAccountType: "bank_account_type",
  };

  for (const [field, key] of Object.entries(fieldMap)) {
    if (body[field] !== undefined) {
      updates.push({ key, value: String(body[field]) });
    }
  }

  await prisma.$transaction(
    updates.map((u) =>
      prisma.setting.upsert({
        where: { key: u.key },
        update: { value: u.value },
        create: { key: u.key, value: u.value },
      })
    )
  );

  return NextResponse.json({ message: "Payment settings updated." });
}
