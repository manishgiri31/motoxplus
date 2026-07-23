import { NextRequest, NextResponse } from "next/server";
import { requireAdmin } from "@/lib/auth/require-admin";
import { prisma } from "@/lib/prisma";

export async function PATCH(
  req: NextRequest,
  props: { params: Promise<{ id: string; recId: string }> }
) {
  const params = await props.params;
  if (!(await requireAdmin())) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const body = await req.json();
  const data: Record<string, unknown> = {};
  if (body.priority !== undefined) data.priority = parseInt(body.priority) || 0;

  const recommendation = await prisma.vehicleProductRecommendation.update({ where: { id: params.recId }, data });
  return NextResponse.json(recommendation);
}

export async function DELETE(
  _req: NextRequest,
  props: { params: Promise<{ id: string; recId: string }> }
) {
  const params = await props.params;
  if (!(await requireAdmin())) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  await prisma.vehicleProductRecommendation.delete({ where: { id: params.recId } });
  return NextResponse.json({ success: true });
}
