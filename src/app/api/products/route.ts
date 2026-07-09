import { NextRequest, NextResponse } from "next/server";
import { getServerSession } from "next-auth";
import { authOptions } from "@/lib/auth";
import { prisma } from "@/lib/prisma";
import { z } from "zod";
import { buildSearchWhere } from "@/lib/product-search";
import { getCompatibleProductIds, type CompatibilityFilter } from "@/lib/vehicle/compatibility";
import { Prisma } from "@prisma/client";

function autoSku(partNumber: string): string {
  const base = partNumber.replace(/[^A-Za-z0-9]/g, "").toUpperCase().slice(0, 14);
  const suffix = Date.now().toString(36).slice(-4).toUpperCase();
  return `${base}-${suffix}`;
}

const productSchema = z.object({
  name: z.string().min(2),
  sku: z.string().min(2).optional(),
  partNumber: z.string().min(2),
  description: z.string().optional(),
  categoryId: z.string(),
  // Pricing & inventory
  price: z.number().min(0),
  mrp: z.number().min(0).optional(),
  gstRate: z.number().default(18),
  hsnCode: z.string().length(8, "HSN code must be exactly 8 digits").regex(/^\d{8}$/, "HSN code must be 8 digits"),
  moq: z.number().min(1).default(1),
  stock: z.number().min(0).default(0),
  // Product identity
  brand: z.string().default("MOTOXPLUS"),
  oemNumber: z.string().optional(),
  warranty: z.string().default("No Warranty"),
  countryOfOrigin: z.string().default("India"),
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
  const vehicleSlug = searchParams.get("vehicle");
  const variantSlug = searchParams.get("variant");
  const sectionSlug = searchParams.get("section");
  const page = parseInt(searchParams.get("page") || "1");
  const pageSize = parseInt(searchParams.get("pageSize") || "12");
  const adminAllParam = searchParams.get("adminAll") === "1";
  // Only admins may bypass the isActive filter
  let adminAll = false;
  if (adminAllParam) {
    const session = await getServerSession(authOptions);
    adminAll = !!session && ["ADMIN", "SUPER_ADMIN"].includes(session.user.role);
  }

  const searchWhere = search ? await buildSearchWhere(search, !adminAll) : {};

  let vehicleWhere = {};
  if (vehicleSlug) {
    const vehicle = await prisma.vehicle.findUnique({ where: { slug: vehicleSlug } });
    if (vehicle) {
      const [selectedVariant, selectedSection] = await Promise.all([
        variantSlug
          ? prisma.vehicleVariant.findFirst({ where: { vehicleId: vehicle.id, slug: variantSlug } })
          : Promise.resolve(null),
        sectionSlug
          ? prisma.vehiclePartSection.findFirst({ where: { slug: sectionSlug } })
          : Promise.resolve(null),
      ]);
      const filter: CompatibilityFilter = {
        vehicleId: vehicle.id,
        variantId: selectedVariant?.id ?? null,
        generationId: selectedVariant?.generationId ?? null,
        sectionId: selectedSection?.id ?? null,
      };
      vehicleWhere = { id: { in: await getCompatibleProductIds(filter) } };
    } else {
      vehicleWhere = { id: { in: [] } };
    }
  }

  const where: any = {
    ...(adminAll ? {} : { isActive: true }),
    ...(category ? { category: { slug: category } } : {}),
    ...searchWhere,
    ...vehicleWhere,
  };

  const [products, total] = await Promise.all([
    prisma.product.findMany({
      where,
      include: {
        category: true,
        productImages: { orderBy: [{ isPrimary: "desc" }, { sortOrder: "asc" }] },
      },
      skip: (page - 1) * pageSize,
      take: pageSize,
      orderBy: [{ stock: "desc" }, { createdAt: "desc" }],
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
    const { productImages, sku: skuInput, ...data } = productSchema.parse(body);
    const sku = skuInput || autoSku(data.partNumber);

    // Check for duplicates before hitting DB constraint
    const conflict = await prisma.product.findFirst({
      where: { OR: [{ sku }, { partNumber: data.partNumber }] },
      select: { sku: true, partNumber: true },
    });
    if (conflict) {
      const field = conflict.sku === sku ? "SKU" : "Part Number";
      const value = conflict.sku === sku ? sku : data.partNumber;
      return NextResponse.json(
        { error: `Duplicate ${field}: a product with ${field} "${value}" already exists` },
        { status: 409 }
      );
    }

    const product = await prisma.product.create({
      data: {
        ...data,
        sku,
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
    if (error instanceof Prisma.PrismaClientKnownRequestError && error.code === "P2002") {
      const fields = (error.meta?.target as string[]) ?? [];
      const field = fields.includes("partNumber") ? "Part Number" : "SKU";
      return NextResponse.json({ error: `Duplicate ${field}: another product uses the same value` }, { status: 409 });
    }
    console.error("Product create error:", error);
    return NextResponse.json({ error: "Failed to create product" }, { status: 500 });
  }
}
