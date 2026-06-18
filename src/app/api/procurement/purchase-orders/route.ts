import { NextRequest, NextResponse } from "next/server";
import { getServerSession } from "next-auth";
import { authOptions } from "@/lib/auth";
import { prisma } from "@/lib/prisma";
import { generatePurchaseOrderNumber } from "@/lib/utils";

const ADMIN_ROLES = ["ADMIN", "SUPER_ADMIN"];

export async function GET(req: NextRequest) {
  const session = await getServerSession(authOptions);
  if (!session || !ADMIN_ROLES.includes(session.user.role)) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const { searchParams } = new URL(req.url);
  const status = searchParams.get("status");
  const vendorId = searchParams.get("vendorId");
  const page = parseInt(searchParams.get("page") || "1");
  const pageSize = 20;

  const where: any = {};
  if (status) where.status = status;
  if (vendorId) where.vendorId = vendorId;

  const [orders, total] = await Promise.all([
    prisma.purchaseOrder.findMany({
      where,
      include: {
        vendor: { select: { id: true, companyName: true, vendorCode: true } },
        items: true,
        purchaseRequest: { select: { id: true, requestNumber: true, title: true } },
        _count: { select: { goodsReceivedNotes: true } },
      },
      orderBy: { createdAt: "desc" },
      skip: (page - 1) * pageSize,
      take: pageSize,
    }),
    prisma.purchaseOrder.count({ where }),
  ]);

  return NextResponse.json({ orders, total, page, pageSize });
}

export async function POST(req: NextRequest) {
  const session = await getServerSession(authOptions);
  if (!session || !ADMIN_ROLES.includes(session.user.role)) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const {
    vendorId, purchaseRequestId, urgency, deliveryDate, deliveryAddress,
    termsAndConditions, items,
  } = await req.json();

  if (!vendorId || !deliveryDate || !deliveryAddress || !items || items.length === 0) {
    return NextResponse.json({ error: "Missing required fields" }, { status: 400 });
  }

  let subtotal = 0;
  let taxAmount = 0;

  const lineItems = items.map((item: any) => {
    const qty = parseInt(item.quantity);
    const price = parseFloat(item.unitPrice);
    const gstRate = parseFloat(item.gstRate || "18");
    const gst = (qty * price * gstRate) / 100;
    const total = qty * price + gst;
    subtotal += qty * price;
    taxAmount += gst;
    return { ...item, quantity: qty, unitPrice: price, gstRate, gstAmount: gst, total, receivedQty: 0 };
  });

  const grandTotal = subtotal + taxAmount;

  const po = await prisma.purchaseOrder.create({
    data: {
      poNumber: generatePurchaseOrderNumber(),
      vendorId,
      createdById: session.user.id,
      purchaseRequestId: purchaseRequestId || null,
      urgency: urgency || "NORMAL",
      deliveryDate: new Date(deliveryDate),
      deliveryAddress,
      subtotal,
      taxAmount,
      grandTotal,
      termsAndConditions: termsAndConditions || null,
      status: "SENT",
      items: {
        create: lineItems.map((item: any) => ({
          description: item.description,
          quantity: item.quantity,
          unit: item.unit || "PCS",
          unitPrice: item.unitPrice,
          gstRate: item.gstRate,
          gstAmount: item.gstAmount,
          total: item.total,
        })),
      },
    },
    include: { vendor: true, items: true },
  });

  // Mark the purchase request as CONVERTED if linked
  if (purchaseRequestId) {
    await prisma.purchaseRequest.update({
      where: { id: purchaseRequestId },
      data: { status: "CONVERTED" },
    });
  }

  return NextResponse.json(po, { status: 201 });
}
