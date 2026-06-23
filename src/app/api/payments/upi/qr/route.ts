import { NextRequest, NextResponse } from "next/server";
import QRCode from "qrcode";
import { prisma } from "@/lib/prisma";

export async function GET(req: NextRequest) {
  const { searchParams } = new URL(req.url);
  const amount = searchParams.get("amount") || "0";
  const orderId = searchParams.get("orderId") || "";
  const orderNumber = searchParams.get("orderNumber") || "";

  const upiIdSetting = await prisma.setting.findUnique({ where: { key: "upi_id" } });
  const upiNameSetting = await prisma.setting.findUnique({ where: { key: "upi_name" } });

  const upiId = upiIdSetting?.value || "5118678468276SB1024@mairtel";
  const upiName = upiNameSetting?.value || "MotoXPlus India Private Limited";

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
