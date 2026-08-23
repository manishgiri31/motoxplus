import { delhiveryPost } from "./client";
import { delhiveryConfig } from "./config";
import { prisma } from "@/lib/prisma";
import type { DelhiveryCreateShipmentResponse, DelhiveryShipmentPayload } from "./types";

const ORIGIN_PINCODE = delhiveryConfig.pickup.pincode;
const PICKUP_NAME = delhiveryConfig.pickup.name;
const PICKUP_ADDRESS = delhiveryConfig.pickup.address;
const PICKUP_CITY = delhiveryConfig.pickup.city;
const PICKUP_STATE = delhiveryConfig.pickup.state;
const PICKUP_PHONE = delhiveryConfig.pickup.phone;
const SELLER_GST = delhiveryConfig.companyGst;

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
