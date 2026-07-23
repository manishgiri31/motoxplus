import { NextRequest, NextResponse } from "next/server";
import { requireAdmin } from "@/lib/auth/require-admin";
import { prisma } from "@/lib/prisma";

export async function PATCH(req: NextRequest, props: { params: Promise<{ id: string }> }) {
  const params = await props.params;
  if (!(await requireAdmin())) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const body = await req.json();
  const data: Record<string, unknown> = {};
  if (body.detectedVehicleId !== undefined) data.detectedVehicleId = body.detectedVehicleId || null;
  if (body.detectedVariantId !== undefined) data.detectedVariantId = body.detectedVariantId || null;

  const log = await prisma.vehicleDetectionLog.update({
    where: { id: params.id },
    data: { ...data, method: "admin-corrected" },
    include: { detectedVehicle: { select: { id: true, name: true } } },
  });
  return NextResponse.json(log);
}
