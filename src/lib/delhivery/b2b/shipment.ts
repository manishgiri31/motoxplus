import { Prisma } from "@prisma/client";
import { prisma } from "@/lib/prisma";
import { isPlaceholderEmail } from "@/lib/phone";
import { submitB2bManifest } from "./manifest";
import { buildB2bManifestInput, b2bBoxCount, type B2bOrderFacts } from "./order-mapping";

/**
 * OrderEvent.type written when a manifest was accepted; also the idempotency
 * marker. `reason` is `job_id=<id>;boxes=<n>` (boxes = sum of shipment_details.
 * box_count) so waiting packages can be summed without re-reading orders.
 * Events written before `boxes` existed have only `job_id=<id>` and count as 1.
 */
export const B2B_MANIFEST_EVENT = "B2B_MANIFEST_SUBMITTED";

const MARKER_RE = /^job_id=([^;]*)(?:;boxes=(\d+))?$/;

function parseManifestMarker(reason: string | null): { jobId: string; boxes: number } {
  const m = MARKER_RE.exec(reason ?? "");
  return { jobId: m?.[1] ?? "", boxes: m?.[2] ? Number(m[2]) : 1 };
}

const B2B_ORDER_INCLUDE = {
  items: { include: { product: true } },
  dealer: { include: { user: { select: { email: true } } } },
  customer: { include: { user: { select: { email: true } } } },
} satisfies Prisma.OrderInclude;

type B2bOrder = Prisma.OrderGetPayload<{ include: typeof B2B_ORDER_INCLUDE }>;

/** Resolves the DB order into the plain facts the manifest mapping needs. */
export function orderToB2bFacts(order: B2bOrder): B2bOrderFacts {
  // Same fallback chain as the B2C path: the order's own delivery fields first,
  // the dealer's profile only for an old/missing field.
  const name = order.deliveryName || order.dealer?.ownerName;
  const address = order.shippingAddress || order.dealer?.address;
  const city = order.deliveryCity || order.dealer?.city;
  const state = order.deliveryState || order.dealer?.state;
  const pincode = order.deliveryPincode || order.dealer?.pincode;
  const phone = order.deliveryPhone || order.dealer?.phone;

  if (!name || !address || !city || !state || !pincode || !phone) {
    throw new Error(`Order ${order.id} has no complete delivery name/address/city/state/pincode/phone — cannot build a B2B manifest`);
  }

  // A B2C customer who skipped the optional email has a placeholder address
  // (never deliverable) — send an empty email rather than a fake one.
  const rawEmail = order.dealer?.user.email ?? order.customer?.user.email ?? "";
  const email = rawEmail && !isPlaceholderEmail(rawEmail) ? rawEmail : "";

  return {
    orderNumber: order.orderNumber,
    grandTotal: order.grandTotal,
    amountDue: order.amountDue,
    consignee: { name, address, city, state, pincode, phone: phone.replace(/\D/g, "").slice(-10), email },
    items: order.items.map((i) => ({
      name: i.product.name,
      quantity: i.quantity,
      weightKg: i.product.packageWeight ?? i.product.weight ?? 0.5,
    })),
  };
}

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
        return { jobId: parseManifestMarker(existing.reason).jobId, alreadySubmitted: true };
      }

      const order = await tx.order.findUnique({ where: { id: orderId }, include: B2B_ORDER_INCLUDE });
      if (!order) throw new Error(`Order ${orderId} not found`);
      if (order.channel !== "B2B") throw new Error(`Order ${orderId} is ${order.channel}, not B2B — wrong Delhivery module`);
      if (order.status === "PENDING" || order.status === "CANCELLED") {
        throw new Error(`Order ${orderId} is ${order.status} — cannot create a shipment for it`);
      }

      // Refused on the prod host until the dev-host job_id check is confirmed.
      const input = buildB2bManifestInput(orderToB2bFacts(order));
      const { jobId } = await submitB2bManifest(input);
      await tx.orderEvent.create({
        data: { orderId, type: B2B_MANIFEST_EVENT, reason: `job_id=${jobId};boxes=${b2bBoxCount(input.shipmentDetails)}` },
      });
      return { jobId, alreadySubmitted: false };
    },
    { timeout: 35_000, maxWait: 8_000 }
  );
}

/**
 * Packages waiting for the B2B warehouse's next pickup: the sum of
 * shipment_details.box_count over manifests accepted since `since` (the
 * previous slot's cutoff — see previousSlotCutoff). B2B has no Shipment rows or
 * tracking sync, so the manifest events are the only record of what is waiting.
 * There is one B2B warehouse (DELHIVERY_PICKUP_LOCATION_B2B), so no per-warehouse
 * filter is needed.
 */
export async function getB2bWaitingPackages(since: Date): Promise<number> {
  const events = await prisma.orderEvent.findMany({
    where: { type: B2B_MANIFEST_EVENT, createdAt: { gte: since } },
    select: { reason: true },
  });
  return events.reduce((sum, e) => sum + parseManifestMarker(e.reason).boxes, 0);
}
