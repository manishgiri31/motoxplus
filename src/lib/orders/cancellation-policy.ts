import { prisma } from "@/lib/prisma";
import { DEFAULT_CANCELLATION_POLICY, type CancellationPolicyInput } from "./cancellation";

/** Singleton row id — see the CancellationPolicy model comment in schema.prisma. */
export const CANCELLATION_POLICY_ID = "singleton";

export async function getCancellationPolicy(): Promise<CancellationPolicyInput> {
  const row = await prisma.cancellationPolicy.findUnique({ where: { id: CANCELLATION_POLICY_ID } });
  if (!row) return DEFAULT_CANCELLATION_POLICY;
  return { preShipChargePercent: row.preShipChargePercent, postShipChargePercent: row.postShipChargePercent };
}

/**
 * Backstop (a) for the carrier-aware dealer cancellation gate: a Shipment older
 * than this many days is treated as post-pickup regardless of its stale local
 * status. Tunable via the Setting table (no migration — generic key/value row)
 * so it can be adjusted without a deploy. Default 3: over-blocking costs a
 * dealer one admin round-trip; under-blocking costs the goods plus a ~98%
 * refund — not symmetric.
 */
export const CARRIER_STALE_DAYS_SETTING_KEY = "cancellation.carrierStaleDays";
export const DEFAULT_CARRIER_STALE_DAYS = 3;

export async function getCarrierStaleDays(): Promise<number> {
  const row = await prisma.setting.findUnique({ where: { key: CARRIER_STALE_DAYS_SETTING_KEY } });
  const parsed = row ? Number(row.value) : NaN;
  return Number.isFinite(parsed) && parsed > 0 ? parsed : DEFAULT_CARRIER_STALE_DAYS;
}
