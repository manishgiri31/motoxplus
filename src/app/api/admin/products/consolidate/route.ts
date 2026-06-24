import { NextRequest, NextResponse } from "next/server";
import { getServerSession } from "next-auth";
import { authOptions } from "@/lib/auth";
import { prisma } from "@/lib/prisma";

function commonPrefix(names: string[]): string {
  if (names.length === 0) return "";
  let prefix = names[0];
  for (let i = 1; i < names.length; i++) {
    while (!names[i].startsWith(prefix)) {
      prefix = prefix.slice(0, -1);
      if (!prefix) return "";
    }
  }
  // Trim trailing spaces and partial words
  return prefix.trimEnd();
}

export async function POST(req: NextRequest) {
  const session = await getServerSession(authOptions);
  if (!session || !["ADMIN", "SUPER_ADMIN"].includes(session.user.role)) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const { parentProductId, variantProductIds, variants } = await req.json();

  if (!parentProductId || !Array.isArray(variantProductIds) || variantProductIds.length === 0) {
    return NextResponse.json(
      { error: "parentProductId and variantProductIds are required" },
      { status: 400 }
    );
  }

  // Fetch parent product
  const parent = await prisma.product.findUnique({ where: { id: parentProductId } });
  if (!parent) return NextResponse.json({ error: "Parent product not found" }, { status: 404 });

  // Fetch variant products
  const variantProducts = await prisma.product.findMany({
    where: { id: { in: variantProductIds } },
    include: {
      productImages: { orderBy: [{ isPrimary: "desc" }], take: 1 },
    },
  });

  if (variantProducts.length === 0) {
    return NextResponse.json({ error: "No valid variant products found" }, { status: 400 });
  }

  // Build the variant data — use provided labels if available, otherwise auto-detect
  const allNames = [parent.name, ...variantProducts.map((p) => p.name)];
  const prefix = commonPrefix(allNames);

  const variantData = variantProducts.map((p, i) => {
    const provided = variants?.[p.id];
    const autoLabel = p.name.replace(prefix, "").trim() || p.name;
    return {
      productId: parentProductId,
      label: provided?.label ?? autoLabel,
      partNumber: provided?.partNumber ?? p.partNumber,
      color: provided?.color ?? null,
      sticker: provided?.sticker ?? null,
      price: provided?.price ?? p.price,
      mrp: provided?.mrp ?? p.mrp,
      stock: provided?.stock ?? p.stock,
      imageUrl: provided?.imageUrl ?? p.productImages[0]?.imageUrl ?? null,
      sortOrder: i,
      isActive: true,
    };
  });

  // Also add the parent itself as a variant if it has a distinct option
  // (only if the parent name differs from the common prefix, meaning it's also a variant)
  const parentLabel = parent.name.replace(prefix, "").trim();
  const includeParentAsVariant = parentLabel.length > 0;

  // Execute in a transaction
  const result = await prisma.$transaction(async (tx) => {
    // Create variants
    const created = await tx.productVariant.createMany({ data: variantData });

    // If parent itself is one of the color options, add it as a variant too
    if (includeParentAsVariant) {
      await tx.productVariant.create({
        data: {
          productId: parentProductId,
          label: parentLabel,
          partNumber: parent.partNumber,
          price: parent.price,
          mrp: parent.mrp ?? undefined,
          stock: parent.stock,
          imageUrl: null,
          sortOrder: variantData.length,
          isActive: true,
        },
      });
    }

    // Update parent product name to the common prefix (the group display name)
    const newName = prefix.trim() || parent.name;
    await tx.product.update({
      where: { id: parentProductId },
      data: { name: newName, isActive: true },
    });

    // Deactivate the merged products
    await tx.product.updateMany({
      where: { id: { in: variantProductIds } },
      data: { isActive: false },
    });

    return { created: created.count + (includeParentAsVariant ? 1 : 0) };
  });

  return NextResponse.json({
    success: true,
    parentProductId,
    variantsCreated: result.created,
    productsDeactivated: variantProductIds.length,
    newProductName: prefix.trim() || parent.name,
  });
}

// Preview: suggest variant labels before consolidation
export async function GET(req: NextRequest) {
  const session = await getServerSession(authOptions);
  if (!session || !["ADMIN", "SUPER_ADMIN"].includes(session.user.role)) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const { searchParams } = new URL(req.url);
  const ids = searchParams.get("ids")?.split(",").filter(Boolean) ?? [];

  if (ids.length < 2) {
    return NextResponse.json({ error: "At least 2 product IDs required" }, { status: 400 });
  }

  const products = await prisma.product.findMany({
    where: { id: { in: ids } },
    select: { id: true, name: true, partNumber: true, price: true, mrp: true, stock: true },
  });

  const prefix = commonPrefix(products.map((p) => p.name));

  return NextResponse.json({
    prefix,
    suggestions: products.map((p) => ({
      id: p.id,
      originalName: p.name,
      suggestedLabel: p.name.replace(prefix, "").trim() || p.name,
      partNumber: p.partNumber,
      price: p.price,
      mrp: p.mrp,
      stock: p.stock,
    })),
  });
}
