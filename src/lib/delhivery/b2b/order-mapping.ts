import { getB2bConfig } from "./config";
import { DelhiveryNotSpecifiedError } from "../errors";
import { roundToPaise } from "@/lib/utils";
import type { B2bManifestInput } from "./manifest";

export interface B2bOrderFacts {
  orderNumber: string;
  /** What is still owed at delivery (post-payment-finalize). */
  amountDue: number;
  /** Total package weight in kg (Product.packageWeight ?? weight, summed). */
  totalWeightKg: number;
}

/**
 * The part of the manifest that follows directly from the spec AND our order
 * data: payment_mode / cod_amount (same rule as B2C — owed at delivery > 0 means
 * cod) and weight in grams.
 */
export function b2bKnownManifestFields(
  facts: B2bOrderFacts
): Pick<B2bManifestInput, "pickupLocationName" | "paymentMode" | "codAmount" | "weightGrams"> {
  const codAmount = roundToPaise(Math.max(0, facts.amountDue));
  const isCod = codAmount > 0;
  return {
    pickupLocationName: getB2bConfig().pickupLocationName,
    paymentMode: isCod ? "cod" : "prepaid",
    ...(isCod ? { codAmount } : {}),
    weightGrams: Math.max(1, Math.round(facts.totalWeightKg * 1000)),
  };
}

/**
 * TODO(spec): order -> dropoff_location / invoices / shipment_details /
 * freight_mode / fm_pickup / rov_insurance.
 *
 * The spec names these fields but not their inner structure or allowed values,
 * so building them would be guessing. Until it is provided, creating a B2B
 * shipment fails here with a clear message (recorded as SHIPMENT_FAILED on the
 * order timeline) instead of sending a malformed manifest to Delhivery.
 */
export function buildB2bManifestInput(facts: B2bOrderFacts): B2bManifestInput {
  void b2bKnownManifestFields(facts); // validates B2B config early
  throw new DelhiveryNotSpecifiedError(
    `B2B manifest for order ${facts.orderNumber} cannot be built: the structure of dropoff_location, invoices, ` +
      `shipment_details and the values of freight_mode, fm_pickup, rov_insurance are not specified yet.`
  );
}
