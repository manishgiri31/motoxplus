import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { getCurrentUserId } from "@/lib/auth/current-user";
import { getVerifiedDealer, ACCOUNT_NOT_VERIFIED_MESSAGE } from "@/lib/auth/verified-account";
import { enforceRateLimit, rejectOversizedBody } from "@/lib/auth/rate-limit-budgets";
import { validateSchemeSelection, type SchemeItemCandidate } from "@/lib/schemes/cart-validation";

interface SchemeItemInput {
  productId: string;
  variantId?: string | null;
  quantity: number;
}

interface SchemeBody {
  /** Omit or null to clear the cart's scheme entirely. */
  schemeId?: string | null;
  items?: SchemeItemInput[];
}

/**
 * Sets (or replaces, or clears) the dealer's cart-level scheme selection.
 * This is a full replace, not a merge — every call re-validates from
 * scratch and overwrites Cart.schemeId + the isSchemeItem CartItem set. The
 * client-supplied benefit/eligibility is never trusted; see
 * lib/schemes/cart-validation.ts for the re-derivation this always redoes.
 */
export async function POST(req: NextRequest) {
  const oversized = rejectOversizedBody(req, 8 * 1024);
  if (oversized) return oversized;

  const userId = await getCurrentUserId(req);
  if (!userId) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  const authUser = await prisma.user.findUnique({ where: { id: userId }, select: { role: true } });
  if (!authUser || authUser.role !== "DEALER") {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const dealer = await getVerifiedDealer(userId);
  if (!dealer) return NextResponse.json({ error: ACCOUNT_NOT_VERIFIED_MESSAGE }, { status: 403 });

  const limited = await enforceRateLimit(req, "SCHEME_APPLY", dealer.id);
  if (limited) return limited;

  const body = (await req.json().catch(() => ({}))) as SchemeBody;

  const cart = await prisma.cart.findUnique({
    where: { dealerId: dealer.id },
    include: { items: { include: { product: { include: { category: true } }, variant: true } } },
  });
  if (!cart) return NextResponse.json({ error: "Cart is empty" }, { status: 400 });

  // Clear: no schemeId means "remove whatever scheme is applied".
  if (!body.schemeId) {
    await prisma.$transaction([
      prisma.cartItem.deleteMany({ where: { cartId: cart.id, isSchemeItem: true } }),
      prisma.cart.update({ where: { id: cart.id }, data: { schemeId: null } }),
    ]);
    return NextResponse.json({ success: true, schemeId: null });
  }

  const items = Array.isArray(body.items) ? body.items : [];
  if (items.some((i) => !i.productId || !Number.isInteger(i.quantity) || i.quantity < 1)) {
    return NextResponse.json({ error: "Invalid scheme item selection" }, { status: 400 });
  }

  const regularItems = cart.items.filter((i) => !i.isSchemeItem);

  // Re-fetch every selected scheme-item product/variant fresh — cart items
  // for the OLD scheme (if any) don't tell us anything about these.
  const productIds = [...new Set(items.map((i) => i.productId))];
  const products = await prisma.product.findMany({
    where: { id: { in: productIds } },
    include: { category: true, variants: true },
  });
  const productById = new Map(products.map((p) => [p.id, p]));

  const schemeItems: SchemeItemCandidate[] = [];
  for (const item of items) {
    const product = productById.get(item.productId);
    if (!product) return NextResponse.json({ error: "One or more selected free items no longer exist" }, { status: 400 });

    let dealerPrice = product.price;
    let variantStock: number | null = null;
    if (item.variantId) {
      const variant = product.variants.find((v) => v.id === item.variantId);
      if (!variant || !variant.isActive) {
        return NextResponse.json({ error: "One or more selected free item variants are no longer available" }, { status: 400 });
      }
      dealerPrice = variant.price;
      variantStock = variant.stock;
    }

    schemeItems.push({
      productId: product.id,
      quantity: item.quantity,
      dealerPrice,
      categoryId: product.categoryId,
      stockStatus: product.stockStatus,
      variantStock,
    });
  }

  const validation = await validateSchemeSelection({
    schemeId: body.schemeId,
    regularItems: regularItems.map((i) => ({ unitPrice: i.variant?.price ?? i.product.price, quantity: i.quantity })),
    schemeItems,
  });
  if (!validation.ok) {
    return NextResponse.json({ error: validation.reason }, { status: 422 });
  }

  await prisma.$transaction([
    prisma.cartItem.deleteMany({ where: { cartId: cart.id, isSchemeItem: true } }),
    prisma.cart.update({ where: { id: cart.id }, data: { schemeId: validation.scheme.id } }),
    ...items.map((item) =>
      prisma.cartItem.create({
        data: {
          cartId: cart.id,
          productId: item.productId,
          variantId: item.variantId || null,
          quantity: item.quantity,
          isSchemeItem: true,
        },
      })
    ),
  ]);

  return NextResponse.json({
    success: true,
    schemeId: validation.scheme.id,
    benefit: validation.benefit,
    itemsValue: validation.itemsValue,
  });
}
