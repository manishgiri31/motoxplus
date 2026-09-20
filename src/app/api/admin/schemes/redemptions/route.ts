import { NextRequest, NextResponse } from "next/server";
import { getServerSession } from "next-auth";
import { authOptions } from "@/lib/auth";
import { prisma } from "@/lib/prisma";

const ADMIN_ROLES = ["ADMIN", "SUPER_ADMIN", "ACCOUNTS"];

/** Read-only report: every scheme redemption, optionally filtered to one scheme, newest first. */
export async function GET(req: NextRequest) {
  const session = await getServerSession(authOptions);
  if (!session || !ADMIN_ROLES.includes(session.user.role)) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const { searchParams } = new URL(req.url);
  const schemeId = searchParams.get("schemeId") || undefined;
  const status = searchParams.get("status") || undefined;
  const page = parseInt(searchParams.get("page") || "1");
  const pageSize = 25;

  const where = {
    ...(schemeId ? { schemeId } : {}),
    ...(status ? { status: status as "ACTIVE" | "ADJUSTED" | "CANCELLED" } : {}),
  };

  const [redemptions, total] = await Promise.all([
    prisma.schemeRedemption.findMany({
      where,
      include: {
        scheme: { select: { id: true, name: true, code: true } },
        order: {
          select: {
            id: true,
            orderNumber: true,
            status: true,
            grandTotal: true,
            schemeAdjustmentAmount: true,
            createdAt: true,
            dealer: { select: { companyName: true } },
          },
        },
      },
      orderBy: { createdAt: "desc" },
      skip: (page - 1) * pageSize,
      take: pageSize,
    }),
    prisma.schemeRedemption.count({ where }),
  ]);

  return NextResponse.json({ redemptions, total, page, pageSize });
}
