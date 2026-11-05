import { NextRequest, NextResponse } from "next/server";
import { parsePageParam } from "@/lib/query-limits";
import { getServerSession } from "next-auth";
import { authOptions } from "@/lib/auth";
import { prisma } from "@/lib/prisma";

export async function GET(req: NextRequest) {
  const session = await getServerSession(authOptions);
  if (!session || !["ADMIN", "SUPER_ADMIN"].includes(session.user.role)) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const { searchParams } = new URL(req.url);
  const status = searchParams.get("status");
  const page = parsePageParam(searchParams.get("page"));
  const pageSize = 20;

  const where: any = {};
  if (status) where.status = status;

  const [dealers, total] = await Promise.all([
    prisma.dealer.findMany({
      where,
      include: { user: true, _count: { select: { orders: true } } },
      orderBy: { createdAt: "desc" },
      skip: (page - 1) * pageSize,
      take: pageSize,
    }),
    prisma.dealer.count({ where }),
  ]);

  return NextResponse.json({ dealers, total, page, pageSize });
}
