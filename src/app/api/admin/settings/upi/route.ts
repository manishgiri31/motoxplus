import { NextRequest, NextResponse } from "next/server";
import { getServerSession } from "next-auth";
import { authOptions } from "@/lib/auth";
import { prisma } from "@/lib/prisma";
import { enforceRateLimit } from "@/lib/auth/rate-limit-budgets";

const ADMIN_ROLES = ["ADMIN", "SUPER_ADMIN"];

// Only these Setting rows are read by the PUBLIC GET, and only to decide whether
// the manual UPI option is usable. Their values are never returned.
const PUBLIC_UPI_KEYS = ["upi_enabled", "upi_id", "upi_name"];

// Public (unauthenticated) read. The dealer checkout calls it for exactly one
// thing, whether to offer the manual UPI payment option, so that is the only
// field returned. The VPA / QR are served per-order by GET /api/payments/upi/[orderId]
// (authenticated) and GET /api/payments/upi/qr; bank account details are only
// ever returned to authenticated order owners / staff, never from here. Do not
// add fields to this response without updating the allow-list test.
export async function GET(req: NextRequest) {
  const limited = await enforceRateLimit(req, "PUBLIC_API");
  if (limited) return limited;

  const settings = await prisma.setting.findMany({ where: { key: { in: PUBLIC_UPI_KEYS } } });
  const map: Record<string, string> = {};
  for (const s of settings) map[s.key] = s.value;

  // Opt-in, not opt-out: Razorpay Checkout already offers UPI (with automatic
  // verification) under Full Payment/20% Advance, so an unconfigured
  // environment shouldn't silently surface the manual screenshot/admin-review
  // flow as well — an admin must explicitly flip this on via Settings.
  if (map.upi_enabled !== "true") {
    return NextResponse.json({ upiEnabled: false });
  }

  // Enabled but no VPA configured: fail closed. There is deliberately no
  // fallback payee: a stale/wrong hardcoded identifier silently receiving real
  // payments is worse than a visible configuration error (same policy as
  // GET /api/payments/upi/qr). `upiEnabled: false` stays in the body so the
  // checkout, which reads `data.upiEnabled !== false`, also disables the option.
  if (!map.upi_id || !map.upi_name) {
    console.error("[UPI settings] upi_enabled is true but upi_id / upi_name Setting is not configured");
    return NextResponse.json(
      { upiEnabled: false, error: "UPI payment is not configured." },
      { status: 503 }
    );
  }

  return NextResponse.json({ upiEnabled: true });
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
