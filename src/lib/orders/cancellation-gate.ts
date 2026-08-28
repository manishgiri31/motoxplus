import { prisma } from "@/lib/prisma";
import { classifyCarrierTier } from "@/lib/delhivery/carrier-cancellation";
import {
  evaluateCancellation,
  calculateCancellation,
  evaluateDealerGateLocal,
  resolveDealerGateFromCarrier,
  defaultAdminStageFromCarrier,
  DEALER_POST_SHIP_BLOCK_MESSAGE,
  type CancellationStage,
  type OrderStatusForCancellation,
  type PaymentTypeForCancellation,
  type ShipmentStatusValue,
} from "./cancellation";
import { getCancellationPolicy, getCarrierStaleDays } from "./cancellation-policy";

export interface GateOrder {
  id: string;
  status: string;
  paymentType: string;
  grandTotal: number;
  amountPaid: number;
  shipment: { waybill: string; status: string; createdAt: Date } | null;
}

export const ORDER_INCLUDE_FOR_GATE = {
  shipment: { select: { waybill: true, status: true, createdAt: true } },
} as const;

function shipmentFacts(order: GateOrder, now: Date) {
  if (!order.shipment) return null;
  return {
    status: order.shipment.status as ShipmentStatusValue,
    ageDays: (now.getTime() - order.shipment.createdAt.getTime()) / (24 * 60 * 60 * 1000),
  };
}

/**
 * Dealer cancellation gate (F-02 / F-04). Local decision first; one live
 * carrier fetch only if that's inconclusive. Returns null → dealer may
 * proceed; `{ reason }` → blocked, route to an admin. Fails closed throughout.
 */
export async function resolveDealerGate(order: GateOrder): Promise<{ reason: string } | null> {
  const now = new Date();
  const carrierStaleDays = await getCarrierStaleDays();
  const local = evaluateDealerGateLocal({
    orderStatus: order.status as OrderStatusForCancellation,
    shipment: shipmentFacts(order, now),
    carrierStaleDays,
  });

  if (local === "ALLOW") return null;
  if (local === "BLOCK") return { reason: DEALER_POST_SHIP_BLOCK_MESSAGE };

  const classification = await classifyCarrierTier(order.shipment!.waybill);
  return resolveDealerGateFromCarrier(classification.tier) === "ALLOW"
    ? null
    : { reason: DEALER_POST_SHIP_BLOCK_MESSAGE };
}

export type CancellationQuotePayload =
  | {
      allowed: true;
      stage: CancellationStage;
      chargePercent: number;
      chargeAmount: number;
      grandTotal: number;
      amountPaid: number;
      refundAmount: number;
      waived: boolean;
      carrierStatus?: string;
    }
  | { allowed: false; grandTotal: number; amountPaid: number; reason: string };

/**
 * The single quote the UI shows before a dealer or admin confirms. The cancel
 * endpoint recomputes everything independently at execution time — nothing from
 * this response is trusted back.
 */
export async function buildCancellationQuote(
  order: GateOrder,
  isDealerActor: boolean
): Promise<CancellationQuotePayload> {
  if (isDealerActor) {
    const blocked = await resolveDealerGate(order);
    if (blocked) {
      return { allowed: false, grandTotal: order.grandTotal, amountPaid: order.amountPaid, reason: blocked.reason };
    }
  }

  const policy = await getCancellationPolicy();
  const eligibility = evaluateCancellation({
    status: order.status as OrderStatusForCancellation,
    paymentType: order.paymentType as PaymentTypeForCancellation,
    policy,
  });
  if (!eligibility.ok) {
    return { allowed: false, grandTotal: order.grandTotal, amountPaid: order.amountPaid, reason: eligibility.message };
  }

  let stage: CancellationStage = eligibility.stage;
  let carrierStatus: string | undefined;
  if (!isDealerActor && order.shipment) {
    const classification = await classifyCarrierTier(order.shipment.waybill);
    stage = defaultAdminStageFromCarrier({
      hasShipment: true,
      carrierTier: classification.tier,
      orderStatusStage: eligibility.stage,
    });
    carrierStatus = classification.rawStatusText || `(${classification.tier})`;
  }

  const feePercent = stage === "PRE_SHIP" ? policy.preShipChargePercent : policy.postShipChargePercent;
  const quote = calculateCancellation({ feePercent, amountPaid: order.amountPaid });
  return {
    allowed: true,
    stage,
    chargePercent: quote.feePercent,
    chargeAmount: quote.feeAmount,
    grandTotal: order.grandTotal,
    amountPaid: order.amountPaid,
    refundAmount: quote.refundAmount,
    waived: quote.waived,
    ...(carrierStatus ? { carrierStatus } : {}),
  };
}

/** Loads the order with exactly the fields the gate/quote need. */
export async function loadGateOrder(orderId: string): Promise<GateOrder | null> {
  return prisma.order.findUnique({
    where: { id: orderId },
    select: {
      id: true,
      status: true,
      paymentType: true,
      grandTotal: true,
      amountPaid: true,
      shipment: { select: { waybill: true, status: true, createdAt: true } },
    },
  });
}
