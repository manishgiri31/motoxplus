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

  const ratings = await prisma.vendorRating.findMany({
    where: { vendorId: params.id },
    orderBy: { createdAt: "desc" },
  });

  const avg =
    ratings.length > 0
      ? ratings.reduce((sum, r) => sum + r.overallScore, 0) / ratings.length
      : 0;

  return NextResponse.json({ ratings, averageScore: Math.round(avg * 10) / 10 });
}

export async function POST(req: NextRequest, props: { params: Promise<{ id: string }> }) {
  const params = await props.params;
  const session = await getServerSession(authOptions);
  if (!session || !ADMIN_ROLES.includes(session.user.role)) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const { qualityScore, deliveryScore, priceScore, period, notes } = await req.json();

  if (!qualityScore || !deliveryScore || !priceScore || !period) {
    return NextResponse.json({ error: "All scores and period are required" }, { status: 400 });
  }

  const overallScore =
    (parseFloat(qualityScore) + parseFloat(deliveryScore) + parseFloat(priceScore)) / 3;

  const rating = await prisma.vendorRating.upsert({
    where: { vendorId_period: { vendorId: params.id, period } },
    create: {
      vendorId: params.id,
      ratedById: session.user.id,
      qualityScore: parseFloat(qualityScore),
      deliveryScore: parseFloat(deliveryScore),
      priceScore: parseFloat(priceScore),
      overallScore: Math.round(overallScore * 10) / 10,
      period,
      notes: notes || null,
    },
    update: {
      ratedById: session.user.id,
      qualityScore: parseFloat(qualityScore),
      deliveryScore: parseFloat(deliveryScore),
      priceScore: parseFloat(priceScore),
      overallScore: Math.round(overallScore * 10) / 10,
      notes: notes || null,
    },
  });

  return NextResponse.json(rating, { status: 201 });
}
