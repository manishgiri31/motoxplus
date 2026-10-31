import { prisma } from "@/lib/prisma";
import { submitB2bManifest } from "./manifest";
import { buildB2bManifestInput } from "./order-mapping";

/** OrderEvent.type written when a manifest was accepted; also the idempotency marker. */
export const B2B_MANIFEST_EVENT = "B2B_MANIFEST_SUBMITTED";

/**
 * Submits the B2B manifest for an order and records the returned job_id on the
 * order timeline. There is NO Shipment row: POST /manifest answers with a
 * job_id only, and where the LR number appears in the status response is not
 * specified, so there is nothing valid to put in Shipment.waybill. The order
 * therefore stays CONFIRMED.
 *
 * Idempotent the same way the B2C path is: a Postgres advisory lock per order,
 * then a re-check — here of the marker OrderEvent instead of a Shipment row —
 * so verify + webhook + a manual admin click can't submit two manifests.
 */
export async function createB2bShipment(orderId: string): Promise<{ jobId: string; alreadySubmitted: boolean }> {
  return prisma.$transaction(
    async (tx) => {
      await tx.$queryRaw`SELECT pg_advisory_xact_lock(hashtext(${`delhivery:b2b-manifest:${orderId}`}))`;

      const existing = await tx.orderEvent.findFirst({
        where: { orderId, type: B2B_MANIFEST_EVENT },
        orderBy: { createdAt: "desc" },
      });
      if (existing) {
        return { jobId: (existing.reason ?? "").replace(/^job_id=/, ""), alreadySubmitted: true };
      }

      const order = await tx.order.findUnique({
        where: { id: orderId },
        include: { items: { include: { product: true } } },
      });
      if (!order) throw new Error(`Order ${orderId} not found`);
      if (order.channel !== "B2B") throw new Error(`Order ${orderId} is ${order.channel}, not B2B — wrong Delhivery module`);
      if (order.status === "PENDING" || order.status === "CANCELLED") {
        throw new Error(`Order ${orderId} is ${order.status} — cannot create a shipment for it`);
      }

      const totalWeightKg = order.items.reduce((sum, item) => {
        const w = item.product.packageWeight ?? item.product.weight ?? 0.5;
        return sum + w * item.quantity;
      }, 0);

      // Throws DelhiveryNotSpecifiedError until the manifest field structure is specified.
      const input = buildB2bManifestInput({
        orderNumber: order.orderNumber,
        amountDue: order.amountDue,
        totalWeightKg,
      });

      const { jobId } = await submitB2bManifest(input);
      await tx.orderEvent.create({ data: { orderId, type: B2B_MANIFEST_EVENT, reason: `job_id=${jobId}` } });
      return { jobId, alreadySubmitted: false };
    },
    { timeout: 35_000, maxWait: 8_000 }
  );
}
