import { prisma } from "@/lib/prisma";
import { DEFAULT_CANCELLATION_POLICY, type CancellationPolicyInput } from "./cancellation";

/** Singleton row id — see the CancellationPolicy model comment in schema.prisma. */
export const CANCELLATION_POLICY_ID = "singleton";

export async function getCancellationPolicy(): Promise<CancellationPolicyInput> {
  const row = await prisma.cancellationPolicy.findUnique({ where: { id: CANCELLATION_POLICY_ID } });
  if (!row) return DEFAULT_CANCELLATION_POLICY;
  return { preShipChargePercent: row.preShipChargePercent, postShipChargePercent: row.postShipChargePercent };
}
