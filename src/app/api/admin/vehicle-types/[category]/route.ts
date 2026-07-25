import { NextRequest, NextResponse } from "next/server";
import { requireAdmin } from "@/lib/auth/require-admin";
import { prisma } from "@/lib/prisma";
import { VehicleCategory } from "@prisma/client";

export async function PATCH(req: NextRequest, props: { params: Promise<{ category: string }> }) {
  const params = await props.params;
  if (!(await requireAdmin())) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const category = params.category.toUpperCase();
  if (!(category in VehicleCategory)) {
    return NextResponse.json({ error: "Unknown category" }, { status: 400 });
  }

  const body = await req.json();
  const heroImage = typeof body.heroImage === "string" ? body.heroImage.trim() || null : null;

  const row = await prisma.vehicleType.upsert({
    where: { category: category as VehicleCategory },
    update: { heroImage },
    create: { category: category as VehicleCategory, heroImage },
  });
  return NextResponse.json(row);
}
