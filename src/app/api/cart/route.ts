import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { getCurrentUserId } from "@/lib/auth/current-user";
import { getVerifiedDealer, ACCOUNT_NOT_VERIFIED_MESSAGE } from "@/lib/auth/verified-account";

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

  const dealer = await getVerifiedDealer(userId);
  if (!dealer) return NextResponse.json({ error: ACCOUNT_NOT_VERIFIED_MESSAGE }, { status: 403 });

  const product = await prisma.product.findUnique({ where: { id: productId, isActive: true } });
  if (!product) return NextResponse.json({ error: "Product not found" }, { status: 404 });

  // Validate variant if provided, and get its MOQ + stock
  let effectiveMoq = product.moq;
  let variant: Awaited<ReturnType<typeof prisma.productVariant.findUnique>> = null;
  if (variantId) {
    variant = await prisma.productVariant.findUnique({ where: { id: variantId } });
    if (!variant || variant.productId !== productId || !variant.isActive) {
      return NextResponse.json({ error: "Invalid variant" }, { status: 400 });
    }
    if (variant.moq != null) effectiveMoq = variant.moq;
  }

  // Validate MOQ
  if (quantity < effectiveMoq || quantity % effectiveMoq !== 0) {
    return NextResponse.json(
      { error: `Quantity must be a multiple of MOQ (${effectiveMoq})` },
      { status: 400 }
    );
  }

  // Reject up front rather than letting the dealer discover it at checkout.
  // Variants still track a real countable quantity, so a variant order is
  // capped to it; a plain product is governed by the admin-set stockStatus
  // instead of a number, so it's either orderable or it isn't.
  if (variant) {
    if (quantity > variant.stock) {
      return NextResponse.json(
        {
          error:
            variant.stock > 0
              ? `Only ${variant.stock} in stock. Please reduce the quantity.`
              : "This item is currently out of stock.",
          availableStock: variant.stock,
        },
        { status: 409 }
      );
    }
  } else if (product.stockStatus === "OUT_OF_STOCK") {
    return NextResponse.json({ error: "This item is currently out of stock." }, { status: 409 });
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

  // Scope the delete to this dealer's own cart — `delete({ where: { id: itemId } })`
  // would remove *any* cart item by id regardless of which dealer's cart it
  // belongs to, since cartId was never checked (IDOR).
  const { count } = await prisma.cartItem.deleteMany({
    where: { id: itemId, cartId: cart.id },
  });
  if (count === 0) return NextResponse.json({ error: "Item not found in cart" }, { status: 404 });

  return NextResponse.json({ success: true });
}
