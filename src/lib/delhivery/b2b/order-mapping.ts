import { getB2bConfig } from "./config";
import type { B2bManifestInput, B2bShipmentDetail } from "./manifest";

/**
 * freight_mode value sent on every manifest.
 * TODO(confirm): "fop" comes from the docs' curl example and has not been
 * confirmed against a live response — verify it on the dev host.
 */
export const B2B_FREIGHT_MODE = "fop";

/** Everything the manifest needs from an order, already resolved (no DB types). */
export interface B2bOrderFacts {
  orderNumber: string;
  grandTotal: number;
  /** What is still owed at delivery (post-payment-finalize): > 0 means cod. */
  amountDue: number;
  consignee: {
    name: string;
    address: string;
    city: string;
    state: string;
    pincode: string;
    phone: string;
    /** "" when the account has no real email (placeholder addresses are not sent). */
    email: string;
  };
  items: Array<{ name: string; quantity: number; weightKg: number }>;
}

const toPaise = (n: number) => Math.round(n * 100) / 100;

/**
 * Order -> POST /manifest input, following the docs' curl example:
 *  - dropoff_location {consignee_name, address, city, state, zip, phone, email}
 *  - invoices [{ewaybill:"", inv_num: order number, inv_amt: order total, inv_qr_code:""}]
 *  - shipment_details [{order_id, box_count:1, description, weight(gm), waybills:[], master:false}]
 *  - payment_mode cod|prepaid; cod_amount = amountDue (cod only)
 *  - fm_pickup true, freight_mode "fop" (see B2B_FREIGHT_MODE)
 *  - rov_insurance ONLY for a retail/co-loader account (config), otherwise the key is absent
 *  - weight in grams, one box per order
 */
export function buildB2bManifestInput(facts: B2bOrderFacts): B2bManifestInput {
  const cfg = getB2bConfig();

  const codAmount = toPaise(Math.max(0, facts.amountDue));
  const isCod = codAmount > 0;

  const totalKg = facts.items.reduce((sum, i) => sum + i.weightKg * i.quantity, 0);
  const weightGrams = Math.max(1, Math.round(totalKg * 1000));

  const description = facts.items
    .map((i) => `${i.name} x${i.quantity}`)
    .join(", ")
    .slice(0, 100);

  const c = facts.consignee;

  return {
    pickupLocationName: cfg.pickupLocationName,
    paymentMode: isCod ? "cod" : "prepaid",
    ...(isCod ? { codAmount } : {}),
    weightGrams,
    dropoffLocation: {
      consignee_name: c.name,
      address: c.address,
      city: c.city,
      state: c.state,
      zip: c.pincode,
      phone: c.phone,
      email: c.email,
    },
    invoices: [{ ewaybill: "", inv_num: facts.orderNumber, inv_amt: toPaise(facts.grandTotal), inv_qr_code: "" }],
    shipmentDetails: [
      {
        order_id: facts.orderNumber,
        box_count: 1,
        description,
        weight: weightGrams,
        waybills: [],
        master: false,
      },
    ],
    freightMode: B2B_FREIGHT_MODE,
    fmPickup: true,
    ...(cfg.retailColoader && cfg.rovInsurance !== null ? { rovInsurance: cfg.rovInsurance } : {}),
  };
}

/** Pickup `expected_package_count` = sum of shipment_details.box_count. */
export function b2bBoxCount(details: B2bShipmentDetail[]): number {
  return details.reduce((sum, d) => sum + d.box_count, 0);
}
