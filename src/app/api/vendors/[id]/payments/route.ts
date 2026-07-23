import { NextRequest, NextResponse } from "next/server";
import { getServerSession } from "next-auth";
import { authOptions } from "@/lib/auth";
import { prisma } from "@/lib/prisma";

const ADMIN_ROLES = ["ADMIN", "SUPER_ADMIN"];

export async function GET(req: NextRequest, props: { params: Promise<{ id: string }> }) {
  const params = await props.params;
  const session = await getServerSession(authOptions);
  if (!session || !ADMIN_ROLES.includes(session.user.role)) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const { searchParams } = new URL(req.url);
  const page = parseInt(searchParams.get("page") || "1");
  const pageSize = 20;

  const [payments, total] = await Promise.all([
    prisma.vendorPayment.findMany({
      where: { vendorId: params.id },
      orderBy: { paymentDate: "desc" },
      skip: (page - 1) * pageSize,
      take: pageSize,
    }),
    prisma.vendorPayment.count({ where: { vendorId: params.id } }),
  ]);

  const totalPaid = await prisma.vendorPayment.aggregate({
    where: { vendorId: params.id, status: "PAID" },
    _sum: { amount: true },
  });

  return NextResponse.json({
    payments,
    total,
    page,
    pageSize,
    totalPaid: totalPaid._sum.amount || 0,
  });
}

export async function POST(req: NextRequest, props: { params: Promise<{ id: string }> }) {
  const params = await props.params;
  const session = await getServerSession(authOptions);
  if (!session || !ADMIN_ROLES.includes(session.user.role)) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const { amount, paymentDate, paymentMode, referenceNumber, status, notes } = await req.json();

  if (!amount || !paymentDate || !paymentMode) {
    return NextResponse.json({ error: "Amount, date and payment mode are required" }, { status: 400 });
  }

  const payment = await prisma.vendorPayment.create({
    data: {
      vendorId: params.id,
      amount: parseFloat(amount),
      paymentDate: new Date(paymentDate),
      paymentMode,
      referenceNumber: referenceNumber || null,
      status: status || "PAID",
      notes: notes || null,
    },
  });

  return NextResponse.json(payment, { status: 201 });
}
