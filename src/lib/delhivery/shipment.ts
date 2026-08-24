import { delhiveryPost } from "./client";
import { delhiveryConfig } from "./config";
import { prisma } from "@/lib/prisma";
import type {
  DelhiveryCreateShipmentRequest,
  DelhiveryCreateShipmentResponse,
  DelhiveryPickupLocation,
  DelhiveryShipmentPayload,
} from "./types";

const ORIGIN_PINCODE = delhiveryConfig.pickup.pincode;
const PICKUP_NAME = delhiveryConfig.pickup.name;
const PICKUP_ADDRESS = delhiveryConfig.pickup.address;
const PICKUP_CITY = delhiveryConfig.pickup.city;
const PICKUP_STATE = delhiveryConfig.pickup.state;
const PICKUP_PHONE = delhiveryConfig.pickup.phone;
const SELLER_GST = delhiveryConfig.companyGst;

export interface BuildShipmentPayloadInput {
  destName: string;
  destAddress: string;
  destPincode: string;
  destCity: string;
  destState: string;
  destPhone: string;
  orderRef: string;
  paymentMode: "Prepaid" | "COD";
  codAmount: number;
  totalAmount: number;
  productsDesc: string;
  hsnCode: string;
  quantity: number;
  weightKg: number;
  addressType: "home" | "office";
  orderDate: string; // YYYY-MM-DD
}

/**
 * Pure payload builder — no DB, no network. Shared by createDelhiveryShipment
 * (real orders, below) and scripts/delhivery-capture.ts, so the capture
 * script actually exercises the same payload-construction code production
 * traffic goes through instead of a hand-rolled copy that can drift.
 */
export function buildShipmentPayload(input: BuildShipmentPayloadInput): DelhiveryShipmentPayload {
  return {
    name: input.destName,
    add: input.destAddress,
    pin: input.destPincode,
    city: input.destCity,
    state: input.destState,
    country: "India",
    phone: input.destPhone,
    order: input.orderRef,
    payment_mode: input.paymentMode,
    return_pin: ORIGIN_PINCODE,
    return_city: PICKUP_CITY,
    return_phone: PICKUP_PHONE,
    return_name: PICKUP_NAME,
    return_add: PICKUP_ADDRESS,
    return_state: PICKUP_STATE,
    return_country: "India",
    products_desc: input.productsDesc,
    hsn_code: input.hsnCode,
    cod_amount: input.codAmount,
    order_date: input.orderDate,
    total_amount: input.totalAmount,
    seller_gst_tin: SELLER_GST,
    shipping_mode: "Surface",
    address_type: input.addressType,
    quantity: input.quantity,
    weight: input.weightKg,
  };
}

/**
 * pickup_location is a SIBLING of `shipments` in the create.json request body
 * (confirmed missing entirely before the 2026-08-23 live capture — see
 * delhivery-reference.md). `name` is the immutable registered pickup location
 * on the Delhivery client, NOT the same value as return_name/PICKUP_NAME above.
 */
export function buildPickupLocation(): DelhiveryPickupLocation {
  return {
    name: delhiveryConfig.pickup.locationName,
    add: PICKUP_ADDRESS,
    city: PICKUP_CITY,
    pin_code: ORIGIN_PINCODE,
    country: "India",
    phone: PICKUP_PHONE,
  };
}

export function buildCreateShipmentRequest(input: BuildShipmentPayloadInput): DelhiveryCreateShipmentRequest {
  return {
    shipments: [buildShipmentPayload(input)],
    pickup_location: buildPickupLocation(),
  };
}

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

  const request = buildCreateShipmentRequest({
    destName,
    destAddress,
    destPincode,
    destCity,
    destState,
    destPhone: destPhone.replace(/\D/g, "").slice(-10),
    orderRef: order.orderNumber,
    paymentMode,
    codAmount,
    totalAmount: order.grandTotal,
    productsDesc: productDesc,
    hsnCode,
    quantity: order.items.reduce((s, i) => s + i.quantity, 0),
    weightKg: Math.max(0.5, totalWeight),
    addressType: "office",
    orderDate: order.createdAt.toISOString().split("T")[0],
  });

  const formData = {
    format: "json",
    data: JSON.stringify(request),
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
