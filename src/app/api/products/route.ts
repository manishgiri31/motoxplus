import { NextRequest, NextResponse } from "next/server";
import { getServerSession } from "next-auth";
import { authOptions } from "@/lib/auth";
import { prisma } from "@/lib/prisma";
import { z } from "zod";

const productSchema = z.object({
  name: z.string().min(2),
  sku: z.string().min(2),
  partNumber: z.string().min(2),
  description: z.string().optional(),
  categoryId: z.string(),
  // Pricing & inventory
  price: z.number().min(0),
  gstRate: z.number().default(18),
  hsnCode: z.string().length(8, "HSN code must be exactly 8 digits").regex(/^\d{8}$/, "HSN code must be 8 digits"),
  moq: z.number().min(1).default(1),
  stock: z.number().min(0).default(0),
  // Product identity
  brand: z.string().default("MOTOXPLUS"),
  oemNumber: z.string().optional(),
  warranty: z.string().default("No Warranty"),
  countryOfOrigin: z.string().default("India"),
  // Physical
  weight: z.number().optional(),
  packageWeight: z.number().gt(0, "Package weight must be > 0"),
  packageLength: z.number().gt(0, "Length must be > 0"),
  packageWidth: z.number().gt(0, "Width must be > 0"),
  packageHeight: z.number().gt(0, "Height must be > 0"),
  // Compat
  compatibility: z.array(z.string()).default([]),
  isActive: z.boolean().default(true),
  // Images (legacy + new)
  images: z.array(z.string()).default([]),
  productImages: z.array(z.object({
    url: z.string(),
    key: z.string(),
    isPrimary: z.boolean(),
    sortOrder: z.number(),
  })).default([]),
});

export async function GET(req: NextRequest) {
  const { searchParams } = new URL(req.url);
  const category = searchParams.get("category");
  const search = searchParams.get("search");
  const page = parseInt(searchParams.get("page") || "1");
  const pageSize = parseInt(searchParams.get("pageSize") || "12");
  const adminAll = searchParams.get("adminAll") === "1";

  const where: any = adminAll ? {} : { isActive: true };
  if (category) where.category = { slug: category };
  if (search) {
    where.OR = [
      { name: { contains: search, mode: "insensitive" } },
      { partNumber: { contains: search, mode: "insensitive" } },
      { sku: { contains: search, mode: "insensitive" } },
      { oemNumber: { contains: search, mode: "insensitive" } },
    ];
  }

  const [products, total] = await Promise.all([
    prisma.product.findMany({
      where,
      include: {
        category: true,
        productImages: { orderBy: [{ isPrimary: "desc" }, { sortOrder: "asc" }] },
      },
      skip: (page - 1) * pageSize,
      take: pageSize,
      orderBy: { createdAt: "desc" },
    }),
    prisma.product.count({ where }),
  ]);

  return NextResponse.json({ products, total, page, pageSize });
}

export async function POST(req: NextRequest) {
  const session = await getServerSession(authOptions);
  if (!session || !["ADMIN", "SUPER_ADMIN"].includes(session.user.role)) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  try {
    const body = await req.json();
    const { productImages, ...data } = productSchema.parse(body);

    const product = await prisma.product.create({
      data: {
        ...data,
        productImages: productImages.length > 0 ? {
          create: productImages.map((img, i) => ({
            imageUrl: img.url,
            key: img.key,
            isPrimary: img.isPrimary,
            sortOrder: i,
          })),
        } : undefined,
      },
      include: {
        category: true,
        productImages: { orderBy: [{ isPrimary: "desc" }, { sortOrder: "asc" }] },
      },
    });

    return NextResponse.json(product, { status: 201 });
  } catch (error) {
    if (error instanceof z.ZodError) {
      return NextResponse.json({ error: "Validation failed", details: error.issues }, { status: 400 });
    }
    console.error("Product create error:", error);
    return NextResponse.json({ error: "Failed to create product" }, { status: 500 });
  }
}
