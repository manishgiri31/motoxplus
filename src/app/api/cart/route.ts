import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { getCurrentUserId } from "@/lib/auth/current-user";

// Accepts either the web NextAuth session or the mobile/plain-login JWT
// (cookie or Bearer) via getCurrentUserId — see lib/auth/current-user.ts.
export async function GET(req: NextRequest) {
  const userId = await getCurrentUserId(req);
  if (!userId) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }
  const authUser = await prisma.user.findUnique({ where: { id: userId }, select: { role: true } });
  if (!authUser || authUser.role !== "DEALER") {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const dealer = await prisma.dealer.findUnique({
    where: { userId },
  });

  if (!dealer) return NextResponse.json({ error: "Dealer not found" }, { status: 404 });

  const cart = await prisma.cart.findUnique({
    where: { dealerId: dealer.id },
    include: {
      items: {
        include: {
          product: { include: { category: true } },
          variant: true,
        },
      },
    },
  });

  return NextResponse.json(cart || { items: [] });
}

export async function POST(req: NextRequest) {
  const userId = await getCurrentUserId(req);
  if (!userId) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }
  const authUser = await prisma.user.findUnique({ where: { id: userId }, select: { role: true } });
  if (!authUser || authUser.role !== "DEALER") {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const { productId, quantity, variantId } = await req.json();

  if (!productId || !quantity || quantity < 1) {
    return NextResponse.json({ error: "Invalid request" }, { status: 400 });
  }

  const dealer = await prisma.dealer.findUnique({ where: { userId } });
  if (!dealer) return NextResponse.json({ error: "Dealer not found" }, { status: 404 });

  const product = await prisma.product.findUnique({ where: { id: productId, isActive: true } });
  if (!product) return NextResponse.json({ error: "Product not found" }, { status: 404 });

  // Validate variant if provided, and get its MOQ
  let effectiveMoq = product.moq;
  if (variantId) {
    const variant = await prisma.productVariant.findUnique({ where: { id: variantId } });
    if (!variant || variant.productId !== productId || !variant.isActive) {
      return NextResponse.json({ error: "Invalid variant" }, { status: 400 });
    }
    if ((variant as any).moq != null) effectiveMoq = (variant as any).moq;
  }

  // Validate MOQ
  if (quantity < effectiveMoq || quantity % effectiveMoq !== 0) {
    return NextResponse.json(
      { error: `Quantity must be a multiple of MOQ (${effectiveMoq})` },
      { status: 400 }
    );
  }

  // Get or create cart
  let cart = await prisma.cart.findUnique({ where: { dealerId: dealer.id } });
  if (!cart) {
    cart = await prisma.cart.create({ data: { dealerId: dealer.id } });
  }

  // Find existing cart item for this product+variant combination
  const existingItem = await prisma.cartItem.findFirst({
    where: {
      cartId: cart.id,
      productId,
      variantId: variantId || null,
    },
  });

  if (existingItem) {
    await prisma.cartItem.update({
      where: { id: existingItem.id },
      data: { quantity },
    });
  } else {
    await prisma.cartItem.create({
      data: {
        cartId: cart.id,
        productId,
        variantId: variantId || null,
        quantity,
      },
    });
  }

  return NextResponse.json({ success: true });
}

export async function DELETE(req: NextRequest) {
  const userId = await getCurrentUserId(req);
  if (!userId) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }
  const authUser = await prisma.user.findUnique({ where: { id: userId }, select: { role: true } });
  if (!authUser || authUser.role !== "DEALER") {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const { itemId } = await req.json();
  if (!itemId) return NextResponse.json({ error: "Item ID required" }, { status: 400 });

  const dealer = await prisma.dealer.findUnique({ where: { userId } });
  if (!dealer) return NextResponse.json({ error: "Dealer not found" }, { status: 404 });

  const cart = await prisma.cart.findUnique({ where: { dealerId: dealer.id } });
  if (!cart) return NextResponse.json({ error: "Cart not found" }, { status: 404 });

  await prisma.cartItem.delete({
    where: { id: itemId },
  });

  return NextResponse.json({ success: true });
}
