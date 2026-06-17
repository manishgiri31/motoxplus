import { NextResponse } from "next/server";
import { getServerSession } from "next-auth";
import { authOptions } from "@/lib/auth";
import { prisma } from "@/lib/prisma";

export async function GET() {
  const session = await getServerSession(authOptions);
  if (!session || !["ADMIN", "SUPER_ADMIN"].includes(session.user.role)) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const [
    totalDealers,
    pendingDealers,
    totalOrders,
    pendingOrders,
    totalProducts,
    totalRevenue,
  ] = await Promise.all([
    prisma.dealer.count({ where: { status: "APPROVED" } }),
    prisma.dealer.count({ where: { status: "PENDING" } }),
    prisma.order.count(),
    prisma.order.count({ where: { status: "PENDING" } }),
    prisma.product.count({ where: { isActive: true } }),
    prisma.payment.aggregate({
      _sum: { amount: true },
      where: { status: "PAID" },
    }),
  ]);

  // Recent orders
  const recentOrders = await prisma.order.findMany({
    take: 5,
    orderBy: { createdAt: "desc" },
    include: { dealer: { include: { user: true } } },
  });

  return NextResponse.json({
    totalDealers,
    pendingDealers,
    totalOrders,
    pendingOrders,
    totalProducts,
    totalRevenue: totalRevenue._sum.amount || 0,
    recentOrders,
  });
}
