import { NextRequest, NextResponse } from "next/server";
import { getServerSession } from "next-auth";
import { authOptions } from "@/lib/auth";
import { prisma } from "@/lib/prisma";

const ADMIN_ROLES = ["ADMIN", "SUPER_ADMIN", "STAFF"];

export async function GET(req: NextRequest) {
  const session = await getServerSession(authOptions);
  if (!session || !ADMIN_ROLES.includes(session.user.role)) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const { searchParams } = new URL(req.url);
  const status = searchParams.get("status") || "";
  const page = parseInt(searchParams.get("page") || "1");
  const pageSize = 20;

  const where = status ? { status: status as any } : {};

  const [submissions, total] = await Promise.all([
    prisma.paymentSubmission.findMany({
      where,
      include: {
        order: {
          select: {
            orderNumber: true,
            grandTotal: true,
            amountDue: true,
            status: true,
            paymentStatus: true,
            createdAt: true,
          },
        },
        dealer: {
          select: {
            companyName: true,
            ownerName: true,
            phone: true,
            gstNumber: true,
            city: true,
            state: true,
          },
        },
      },
      orderBy: { submittedAt: "desc" },
      skip: (page - 1) * pageSize,
      take: pageSize,
    }),
    prisma.paymentSubmission.count({ where }),
  ]);

  // Summary counts
  const [submittedCount, underReviewCount, verifiedCount, rejectedCount] = await Promise.all([
    prisma.paymentSubmission.count({ where: { status: "SUBMITTED" } }),
    prisma.paymentSubmission.count({ where: { status: "UNDER_REVIEW" } }),
    prisma.paymentSubmission.count({ where: { status: "VERIFIED" } }),
    prisma.paymentSubmission.count({ where: { status: "REJECTED" } }),
  ]);

  return NextResponse.json({
    submissions,
    total,
    page,
    pageSize,
    counts: { submitted: submittedCount, underReview: underReviewCount, verified: verifiedCount, rejected: rejectedCount },
  });
}
