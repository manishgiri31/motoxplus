import { NextRequest, NextResponse } from "next/server";
import { requireAdmin } from "@/lib/auth/require-admin";
import { prisma } from "@/lib/prisma";

function toFrameUrls(v: unknown): string[] {
  if (Array.isArray(v)) return v.map(String).map((s) => s.trim()).filter(Boolean);
  if (typeof v === "string") return v.split(/\r?\n/).map((s) => s.trim()).filter(Boolean);
  return [];
}

export async function GET(_req: NextRequest, props: { params: Promise<{ id: string }> }) {
  const params = await props.params;
  if (!(await requireAdmin())) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const spins = await prisma.vehicleSpin.findMany({
    where: { vehicleId: params.id },
    orderBy: { sortOrder: "asc" },
  });
  return NextResponse.json(spins);
}

export async function POST(req: NextRequest, props: { params: Promise<{ id: string }> }) {
  const params = await props.params;
  if (!(await requireAdmin())) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const body = await req.json();
  const frameUrls = toFrameUrls(body.frameUrls);
  if (frameUrls.length === 0) {
    return NextResponse.json({ error: "At least one frame URL is required" }, { status: 400 });
  }

  const spin = await prisma.vehicleSpin.create({
    data: {
      vehicleId: params.id,
      variantId: body.variantId || null,
      colorId: body.colorId || null,
      frameUrls,
      frameCount: frameUrls.length,
      sortOrder: body.sortOrder ? parseInt(body.sortOrder) : 0,
    },
  });
  return NextResponse.json(spin, { status: 201 });
}
