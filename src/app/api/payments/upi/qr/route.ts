import { NextRequest, NextResponse } from "next/server";
import QRCode from "qrcode";
import { prisma } from "@/lib/prisma";
import { checkIPRateLimit } from "@/lib/auth/rate-limit";
import { getClientIP } from "@/lib/auth/middleware";

export async function GET(req: NextRequest) {
  const ip = getClientIP(req);
  if (!(await checkIPRateLimit(ip, 20, 60))) {
    return NextResponse.json({ error: "Too many requests. Try again later." }, { status: 429 });
  }

  const { searchParams } = new URL(req.url);
  const amountParam = searchParams.get("amount") || "0";
  const amount = Number(amountParam);
  if (!Number.isFinite(amount) || amount < 0) {
    return NextResponse.json({ error: "Invalid amount" }, { status: 400 });
  }

  const upiIdSetting = await prisma.setting.findUnique({ where: { key: "upi_id" } });
  const upiNameSetting = await prisma.setting.findUnique({ where: { key: "upi_name" } });

  // Fail closed rather than falling back to a hardcoded VPA: a stale/wrong
  // hardcoded payment identifier silently receiving real customer payments
  // is worse than a visible configuration error.
  if (!upiIdSetting?.value || !upiNameSetting?.value) {
    console.error("[UPI QR] upi_id / upi_name Setting not configured");
    return NextResponse.json({ error: "UPI payment is not configured. Please contact support." }, { status: 503 });
  }

  const upiId = upiIdSetting.value;
  const upiName = upiNameSetting.value;

  const upiLink = `upi://pay?pa=${encodeURIComponent(upiId)}&pn=${encodeURIComponent(upiName)}&am=${amount}&cu=INR`;

  const qrBuffer = await QRCode.toBuffer(upiLink, {
    type: "png",
    width: 400,
    margin: 2,
    color: { dark: "#000000", light: "#ffffff" },
  });

  return new NextResponse(qrBuffer as unknown as BodyInit, {
    status: 200,
    headers: {
      "Content-Type": "image/png",
      "Cache-Control": "no-store",
    },
  });
}
