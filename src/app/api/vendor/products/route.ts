import { NextRequest, NextResponse } from "next/server";
import { getServerSession } from "next-auth";
import { authOptions } from "@/lib/auth";
import { prisma } from "@/lib/prisma";
import { z } from "zod";

const vendorProductSchema = z.object({
  name: z.string().min(2),
  sku: z.string().min(2),
  partNumber: z.string().min(2),
  description: z.string().optional(),
  categoryId: z.string(),
  vendorCostPrice: z.number().min(0),
  moq: z.number().min(1).default(1),
  brand: z.string().optional(),
  oemNumber: z.string().optional(),
  compatibility: z.array(z.string()).default([]),
  warranty: z.string().default("No Warranty"),
  countryOfOrigin: z.string().default("India"),
  hsnCode: z.string().optional(),
  gstRate: z.number().default(18),
  packageWeight: z.number().optional(),
  packageLength: z.number().optional(),
  packageWidth: z.number().optional(),
  packageHeight: z.number().optional(),
});

export async function GET() {
  const session = await getServerSession(authOptions);
  if (!session || session.user.role !== "VENDOR") {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const vendor = await prisma.vendor.findUnique({ where: { userId: session.user.id } });
  if (!vendor) return NextResponse.json({ error: "Vendor not found" }, { status: 404 });

  const products = await prisma.product.findMany({
    where: { vendorId: vendor.id },
    include: { category: true },
    orderBy: { createdAt: "desc" },
  });

  return NextResponse.json({ products });
}

export async function POST(req: NextRequest) {
  const session = await getServerSession(authOptions);
  if (!session || session.user.role !== "VENDOR") {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const vendor = await prisma.vendor.findUnique({ where: { userId: session.user.id } });
  if (!vendor) return NextResponse.json({ error: "Vendor not found" }, { status: 404 });
  if (vendor.status !== "APPROVED") {
    return NextResponse.json({ error: "Only approved vendors can submit products" }, { status: 403 });
  }

  try {
    const body = await req.json();
    const data = vendorProductSchema.parse(body);

    // Get default markup from settings
    const markupSetting = await prisma.setting.findUnique({ where: { key: "vendor_markup_percent" } });
    const markupPercent = markupSetting ? parseFloat(markupSetting.value) : 20;

    // Auto-calculate dealer price from vendor cost + markup
    const price = data.vendorCostPrice * (1 + markupPercent / 100);

    const product = await prisma.product.create({
      data: {
        ...data,
        hsnCode: data.hsnCode || "",
        price,
        markupPercent,
        vendorId: vendor.id,
        isActive: false, // pending admin review
        images: [],
      },
      include: { category: true },
    });

    return NextResponse.json(product, { status: 201 });
  } catch (error) {
    if (error instanceof z.ZodError) {
      return NextResponse.json({ error: "Validation failed", details: error.issues }, { status: 400 });
    }
    console.error("Vendor product create error:", error);
    return NextResponse.json({ error: "Failed to submit product" }, { status: 500 });
  }
}
