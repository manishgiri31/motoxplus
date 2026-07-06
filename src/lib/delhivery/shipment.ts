import { delhiveryPost } from "./client";
import { prisma } from "@/lib/prisma";
import type { DelhiveryCreateShipmentResponse, DelhiveryShipmentPayload } from "./types";

const ORIGIN_PINCODE = process.env.DELHIVERY_ORIGIN_PINCODE || "110046";
const PICKUP_NAME = process.env.DELHIVERY_PICKUP_NAME || "MotoXPlus India Pvt. Ltd.";
const PICKUP_ADDRESS = process.env.DELHIVERY_PICKUP_ADDRESS || "RZ-43/291, Street Number 6, Geetanjli Park, Sagarpur West";
const PICKUP_CITY = process.env.DELHIVERY_PICKUP_CITY || "New Delhi";
const PICKUP_STATE = process.env.DELHIVERY_PICKUP_STATE || "Delhi";
const PICKUP_PHONE = process.env.DELHIVERY_PICKUP_PHONE || "9217131801";
const SELLER_GST = process.env.NEXT_PUBLIC_COMPANY_GST || "07AAUCM5765B1Z4";

export async function createDelhiveryShipment(orderId: string): Promise<{
  waybill: string;
  trackingUrl: string;
}> {
  const order = await prisma.order.findUnique({
    where: { id: orderId },
    include: {
      dealer: true,
      items: { include: { product: true } },
      shipment: true,
    },
  });

  if (!order) throw new Error(`Order ${orderId} not found`);
  if (order.shipment) throw new Error(`Shipment already exists for order ${orderId}`);

  const destPincode = order.deliveryPincode || order.dealer.pincode;
  const destCity = order.deliveryCity || order.dealer.city;
  const destState = order.deliveryState || order.dealer.state;
  const destAddress = order.shippingAddress || order.dealer.address;
  const destName = order.deliveryName || order.dealer.ownerName;
  const destPhone = order.deliveryPhone || order.dealer.phone;

  if (!destAddress || !destPincode) {
    throw new Error(`Order ${orderId} has no shipping address/pincode and dealer has none on file — cannot create shipment`);
  }

  const totalWeight = order.items.reduce((sum, item) => {
    const w = item.product.packageWeight ?? item.product.weight ?? 0.5;
    return sum + w * item.quantity;
  }, 0);

  const isCOD = order.paymentType === "COD";
  const codAmount = isCOD ? order.grandTotal : 0;
  const paymentMode = isCOD ? "COD" : "Prepaid";

  const productDesc = order.items
    .map((i) => `${i.product.name} x${i.quantity}`)
    .join(", ")
    .slice(0, 100);

  const hsnCode = order.items[0]?.product.hsnCode || "87141090";

  const payload: DelhiveryShipmentPayload = {
    name: destName,
    add: destAddress,
    pin: destPincode,
    city: destCity,
    state: destState,
    country: "India",
    phone: destPhone.replace(/\D/g, "").slice(-10),
    order: order.orderNumber,
    payment_mode: paymentMode,
    return_pin: ORIGIN_PINCODE,
    return_city: PICKUP_CITY,
    return_phone: PICKUP_PHONE,
    return_name: PICKUP_NAME,
    return_add: PICKUP_ADDRESS,
    return_state: PICKUP_STATE,
    return_country: "India",
    products_desc: productDesc,
    hsn_code: hsnCode,
    cod_amount: codAmount,
    order_date: order.createdAt.toISOString().split("T")[0],
    total_amount: order.grandTotal,
    seller_gst_tin: SELLER_GST,
    shipping_mode: "Surface",
    address_type: "office",
    quantity: order.items.reduce((s, i) => s + i.quantity, 0),
    weight: Math.max(0.5, totalWeight),
  };

  const formData = {
    format: "json",
    data: JSON.stringify({ shipments: [payload] }),
  };

  const response = await delhiveryPost<DelhiveryCreateShipmentResponse>(
    "/api/cmu/create.json",
    formData
  );

  if (!response.success || !response.packages?.[0]) {
    throw new Error(
      `Delhivery shipment creation failed: ${response.packages?.[0]?.remarks || response.rmk || "Unknown error"}`
    );
  }

  const pkg = response.packages[0];

  if (pkg.status !== "Success") {
    throw new Error(`Delhivery rejected shipment: ${pkg.remarks}`);
  }

  const waybill = pkg.waybill;
  const trackingUrl = `https://www.delhivery.com/track/package/${waybill}`;

  await prisma.$transaction([
    prisma.shipment.create({
      data: {
        orderId: order.id,
        waybill,
        status: "MANIFESTED",
        trackingUrl,
        weight: Math.max(0.5, totalWeight),
      },
    }),
    prisma.order.update({
      where: { id: order.id },
      data: { status: "PROCESSING" },
    }),
  ]);

  return { waybill, trackingUrl };
}
