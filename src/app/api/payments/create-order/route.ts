import { NextRequest, NextResponse } from "next/server";
import { getServerSession } from "next-auth";
import { authOptions } from "@/lib/auth";
import { prisma } from "@/lib/prisma";
import Razorpay from "razorpay";

const razorpay = new Razorpay({
  key_id: process.env.RAZORPAY_KEY_ID!,
  key_secret: process.env.RAZORPAY_KEY_SECRET!,
});

export async function POST(req: NextRequest) {
  const session = await getServerSession(authOptions);
  if (!session || session.user.role !== "DEALER") {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const { orderId } = await req.json();

  const order = await prisma.order.findUnique({
    where: { id: orderId },
    include: { dealer: true },
  });

  if (!order) return NextResponse.json({ error: "Order not found" }, { status: 404 });

  // Verify dealer owns order
  const dealer = await prisma.dealer.findUnique({ where: { userId: session.user.id } });
  if (order.dealerId !== dealer?.id) {
    return NextResponse.json({ error: "Forbidden" }, { status: 403 });
  }

  const amountInPaise = Math.round(order.amountDue * 100);

  const razorpayOrder = await razorpay.orders.create({
    amount: amountInPaise,
    currency: "INR",
    receipt: order.orderNumber,
    notes: {
      orderId: order.id,
      dealerId: dealer.id,
    },
  });

  // Create payment record
  await prisma.payment.create({
    data: {
      orderId: order.id,
      razorpayOrderId: razorpayOrder.id,
      amount: order.amountDue,
      paymentType: order.paymentType,
      status: "PENDING",
    },
  });

  return NextResponse.json({
    razorpayOrderId: razorpayOrder.id,
    amount: amountInPaise,
    currency: "INR",
    keyId: process.env.RAZORPAY_KEY_ID,
    orderNumber: order.orderNumber,
  });
}
