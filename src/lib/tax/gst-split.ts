import { roundToPaise } from "@/lib/utils";
import { resolveGstStateCode } from "./state-codes";

export interface GstSplitInput {
  /** Delivery state — determines the place of supply. */
  placeOfSupply: string;
  /** The seller's registered state (see lib/tax/seller-state.ts). */
  sellerState: string;
  gstAmount: number;
}

export interface GstSplitResult {
  cgstAmount: number;
  sgstAmount: number;
  igstAmount: number;
}

/**
 * Thrown instead of guessing when a state can't be resolved to a GST code —
 * silently defaulting either way here means charging the wrong tax head,
 * which is exactly the failure mode worth failing loudly for instead.
 */
export class UnrecognizedStateError extends Error {
  constructor(public readonly state: string) {
    super(`Unrecognized state for GST place-of-supply: "${state}"`);
    this.name = "UnrecognizedStateError";
  }
}

/**
 * Same state as the seller -> CGST + SGST, split evenly. Different state ->
 * IGST, all of it. cgstAmount + sgstAmount is derived as gstAmount minus the
 * other half (not independently rounded) so the two always sum to exactly
 * gstAmount even when gstAmount has an odd paisa — same reconciliation
 * discipline as lib/pricing/compute.ts's order-level gstAmount fix.
 */
export function computeGstSplit(params: GstSplitInput): GstSplitResult {
  const supplyCode = resolveGstStateCode(params.placeOfSupply);
  if (!supplyCode) throw new UnrecognizedStateError(params.placeOfSupply);

  const sellerCode = resolveGstStateCode(params.sellerState);
  if (!sellerCode) throw new UnrecognizedStateError(params.sellerState);

  if (supplyCode === sellerCode) {
    const cgstAmount = roundToPaise(params.gstAmount / 2);
    const sgstAmount = roundToPaise(params.gstAmount - cgstAmount);
    return { cgstAmount, sgstAmount, igstAmount: 0 };
  }

  return { cgstAmount: 0, sgstAmount: 0, igstAmount: roundToPaise(params.gstAmount) };
}
