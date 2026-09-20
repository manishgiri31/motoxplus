import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { generateOrderNumber, roundToPaise } from "@/lib/utils";
import { getCurrentUserId } from "@/lib/auth/current-user";
import { getVerifiedDealer, ACCOUNT_NOT_VERIFIED_MESSAGE } from "@/lib/auth/verified-account";
import { enforceRateLimit, rejectOversizedBody } from "@/lib/auth/rate-limit-budgets";
import { computeOrderPricing } from "@/lib/pricing/compute";
import { computeShippingQuote } from "@/lib/shipping/quote";
import { validateSchemeSelection, type SchemeItemCandidate } from "@/lib/schemes/cart-validation";

export async function GET(req: NextRequest) {
  // Accepts either the web NextAuth session or the mobile/plain-login JWT
  // (cookie or Bearer) via getCurrentUserId — see lib/auth/current-user.ts.
  const userId = await getCurrentUserId(req);
  if (!userId) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const authUser = await prisma.user.findUnique({ where: { id: userId }, select: { role: true } });
  if (!authUser) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const { searchParams } = new URL(req.url);
  const page = parseInt(searchParams.get("page") || "1");
  const pageSize = 10;

  if (authUser.role === "DEALER") {
    const dealer = await prisma.dealer.findUnique({ where: { userId } });
    if (!dealer) return NextResponse.json({ error: "Dealer not found" }, { status: 404 });

    const [orders, total] = await Promise.all([
      prisma.order.findMany({
        where: { dealerId: dealer.id },
        include: { items: { include: { product: true } }, invoice: true, shipment: true },
        orderBy: { createdAt: "desc" },
        skip: (page - 1) * pageSize,
        take: pageSize,
      }),
      prisma.order.count({ where: { dealerId: dealer.id } }),
    ]);

    return NextResponse.json({ orders, total, page, pageSize });
  }

  if (authUser.role === "ADMIN" || authUser.role === "SUPER_ADMIN") {
    const [orders, total] = await Promise.all([
      prisma.order.findMany({
        include: {
          dealer: { include: { user: true } },
          items: { include: { product: true } },
          invoice: true,
          shipment: true,
        },
        orderBy: { createdAt: "desc" },
        skip: (page - 1) * pageSize,
        take: pageSize,
      }),
      prisma.order.count(),
    ]);

    return NextResponse.json({ orders, total, page, pageSize });
  }

  return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
}

export async function POST(req: NextRequest) {
  const oversized = rejectOversizedBody(req, 8 * 1024);
  if (oversized) return oversized;

  const userId = await getCurrentUserId(req);
  if (!userId) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }
  const authUser = await prisma.user.findUnique({ where: { id: userId }, select: { role: true } });
  if (!authUser || authUser.role !== "DEALER") {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const {
    paymentType,
    notes,
    deliveryName,
    deliveryPhone,
    deliveryAddress,
    deliveryCity,
    deliveryState,
    deliveryPincode,
    clientShippingCost,
  } = await req.json();

  // Pure COD (nothing paid upfront) was removed 2026-09-13 — every new order
  // is either paid in full now or via a 20% advance now with the remaining
  // 80% collected as cash/COD by the courier at delivery (see
  // lib/delhivery/shipment.ts's codAmount/paymentMode derivation, which
  // already keys off amountDue rather than this label). Historical orders
  // with paymentType COD still exist and are handled read-only everywhere
  // else (cancellation, shipment, invoices) — only creation is blocked here.
  if (!paymentType || !["ADVANCE_20", "FULL_100"].includes(paymentType)) {
    return NextResponse.json({ error: "Invalid payment type" }, { status: 400 });
  }

  if (!deliveryPincode || !/^\d{6}$/.test(deliveryPincode)) {
    return NextResponse.json({ error: "Valid delivery pincode is required" }, { status: 400 });
  }

  const dealer = await getVerifiedDealer(userId);
  if (!dealer) return NextResponse.json({ error: ACCOUNT_NOT_VERIFIED_MESSAGE }, { status: 403 });

  const limited = await enforceRateLimit(req, "ORDER_CREATE", dealer.id);
  if (limited) return limited;

  const cart = await prisma.cart.findUnique({
    where: { dealerId: dealer.id },
    include: { items: { include: { product: { include: { category: true } }, variant: true } } },
  });

  if (!cart || cart.items.length === 0) {
    return NextResponse.json({ error: "Cart is empty" }, { status: 400 });
  }

  // Cart items can sit for a long time between add-to-cart and checkout —
  // re-check availability now rather than trusting whatever was true when the
  // item was added. Price is always read fresh from product/variant below
  // (the cart never snapshots a price), so that part can't go stale; stock
  // and active status can, and previously were never re-checked here.
  const unavailable = cart.items.filter((item) => {
    if (!item.product.isActive) return true;
    if (item.variant) return !item.variant.isActive || item.variant.stock < item.quantity;
    return item.product.stockStatus === "OUT_OF_STOCK";
  });
  if (unavailable.length > 0) {
    return NextResponse.json(
      {
        error: "Some items in your cart are no longer available in the requested quantity. Please update your cart.",
        unavailableProductIds: unavailable.map((i) => i.productId),
      },
      { status: 409 }
    );
  }

  // B2C-EXPANSION-PLAN.md Phase 0 — channel seam. This route only ever
  // creates B2B dealer orders (POST above already 401s any non-DEALER
  // role), so "B2B" is passed explicitly rather than left to Order.channel's
  // schema default. computeOrderPricing/computeShippingQuote are pure
  // (no DB) — see src/lib/pricing/compute.ts and src/lib/shipping/quote.ts,
  // and their golden test (src/lib/__tests__/golden-b2b-order.test.ts) for
  // the exact numbers this must keep producing.
  const channel = "B2B" as const;

  // Scheme freebie lines are priced/taxed separately below (full rate +
  // 100% "Scheme Discount", never mixed into the regular pricing math) —
  // see lib/schemes/pricing.ts / OrderItem.schemeDiscountAmount doc comment.
  const regularItems = cart.items.filter((item) => !item.isSchemeItem);
  const schemeCartItems = cart.items.filter((item) => item.isSchemeItem);

  const pricing = computeOrderPricing({
    channel,
    items: regularItems.map((item) => ({
      productId: item.productId,
      variantId: item.variantId,
      variantLabel: item.variant?.label ?? null,
      variantSku: (item.variant as any)?.sku ?? null,
      quantity: item.quantity,
      unitPrice: item.variant?.price ?? item.product.price,
      gstRate: item.product.gstRate,
    })),
  });

  // Re-validate the applied scheme from scratch — never trust that it was
  // still valid when it was set on the cart. Client-supplied benefit is
  // never trusted; see lib/schemes/cart-validation.ts.
  let schemeValidation: Awaited<ReturnType<typeof validateSchemeSelection>> | null = null;
  if (cart.schemeId) {
    const schemeItems: SchemeItemCandidate[] = schemeCartItems.map((item) => ({
      productId: item.productId,
      quantity: item.quantity,
      dealerPrice: item.variant?.price ?? item.product.price,
      categoryId: item.product.categoryId,
      stockStatus: item.product.stockStatus,
      variantStock: item.variant?.stock ?? null,
    }));
    schemeValidation = await validateSchemeSelection({
      schemeId: cart.schemeId,
      regularItems: regularItems.map((item) => ({
        unitPrice: item.variant?.price ?? item.product.price,
        quantity: item.quantity,
      })),
      schemeItems,
    });
    if (!schemeValidation.ok) {
      return NextResponse.json(
        {
          error: `Your GST Benefit selection is no longer valid: ${schemeValidation.reason}. Please review the free items in your cart before placing the order.`,
          code: "SCHEME_INVALID",
        },
        { status: 409 }
      );
    }
  }

  const schemeLines = schemeCartItems.map((item) => {
    const dealerPrice = item.variant?.price ?? item.product.price;
    const lineValue = roundToPaise(dealerPrice * item.quantity);
    return {
      productId: item.productId,
      variantId: item.variantId,
      variantLabel: item.variant?.label ?? null,
      variantSku: (item.variant as any)?.sku ?? null,
      quantity: item.quantity,
      unitPrice: dealerPrice,
      gstRate: item.product.gstRate,
      gstAmount: 0,
      total: 0,
      isSchemeItem: true,
      schemeDiscountAmount: lineValue,
      dealerPriceAtOrder: dealerPrice,
    };
  });

  const orderTotal = roundToPaise(pricing.subtotal + pricing.gstAmount);
  const { shippingCost } = computeShippingQuote({ channel, orderTotal });
  const grandTotal = roundToPaise(orderTotal + shippingCost);

  const amountDue = roundToPaise(
    paymentType === "ADVANCE_20" ? grandTotal * 0.2 : grandTotal
  );

  // Every order (ADVANCE_20 or FULL_100) is now born PENDING/unreserved —
  // stock is only decremented and the invoice only generated at payment
  // finalization (lib/payments/finalize.ts for Razorpay, admin/payments/[id]/
  // verify for manual UPI). This used to branch on isCOD (COD orders were
  // created pre-CONFIRMED with stock reserved immediately); that branch was
  // removed with pure COD itself on 2026-09-13 — see the PaymentType.COD
  // doc comment in prisma/schema.prisma.
  const order = await prisma.$transaction(async (tx) => {
    const created = await tx.order.create({
      data: {
        orderNumber: generateOrderNumber(),
        dealerId: dealer.id,
        channel,
        subtotal: pricing.subtotal,
        gstAmount: pricing.gstAmount,
        shippingCost,
        grandTotal,
        paymentType,
        amountDue,
        amountPaid: 0,
        notes,
        status: "PENDING",
        paymentStatus: "PENDING",
        stockReserved: false,
        schemeBenefitValue: schemeValidation?.ok ? schemeValidation.itemsValue : 0,
        shippingAddress: deliveryAddress,
        deliveryName: deliveryName || dealer.ownerName,
        deliveryPhone: deliveryPhone || dealer.phone,
        deliveryCity: deliveryCity || dealer.city,
        deliveryState: deliveryState || dealer.state,
        deliveryPincode,
        items: { create: [...pricing.lines, ...schemeLines] },
      },
    });

    if (schemeValidation?.ok) {
      await tx.schemeRedemption.create({
        data: {
          orderId: created.id,
          schemeId: schemeValidation.scheme.id,
          benefitValue: schemeValidation.benefit,
          itemsValue: schemeValidation.itemsValue,
        },
      });
    }

    return created;
  });

  // Clear cart (regular + scheme items, and the scheme selection itself).
  await prisma.$transaction([
    prisma.cartItem.deleteMany({ where: { cartId: cart.id } }),
    prisma.cart.update({ where: { id: cart.id }, data: { schemeId: null } }),
  ]);

  return NextResponse.json({ order });
}
