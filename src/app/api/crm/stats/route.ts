import { NextRequest, NextResponse } from "next/server";
import { getServerSession } from "next-auth";
import { authOptions } from "@/lib/auth";
import { prisma } from "@/lib/prisma";

const ADMIN_ROLES = ["ADMIN", "SUPER_ADMIN"];

export async function GET(req: NextRequest) {
  const session = await getServerSession(authOptions);
  if (!session || !ADMIN_ROLES.includes(session.user.role)) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const [
    totalLeads,
    byStatus,
    overdueFollowUps,
    convertedThisMonth,
    recentActivities,
  ] = await Promise.all([
    prisma.lead.count(),
    prisma.lead.groupBy({ by: ["status"], _count: true }),
    prisma.lead.count({
      where: {
        nextFollowUp: { lt: new Date() },
        status: { notIn: ["CONVERTED", "LOST"] },
      },
    }),
    prisma.lead.count({
      where: {
        status: "CONVERTED",
        convertedAt: {
          gte: new Date(new Date().getFullYear(), new Date().getMonth(), 1),
        },
      },
    }),
    prisma.leadActivity.findMany({
      take: 10,
      orderBy: { createdAt: "desc" },
      include: { lead: { select: { id: true, companyName: true, status: true } } },
    }),
  ]);

  const statusMap = Object.fromEntries(byStatus.map((s) => [s.status, s._count]));

  return NextResponse.json({
    totalLeads,
    byStatus: statusMap,
    overdueFollowUps,
    convertedThisMonth,
    recentActivities,
  });
}
