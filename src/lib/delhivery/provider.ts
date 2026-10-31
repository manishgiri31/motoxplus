import { prisma } from "@/lib/prisma";
import { toDelhiveryChannel, type DelhiveryChannel } from "./config";
import { b2cProvider } from "./b2c/provider";
import { b2bProvider } from "./b2b/provider";

export type ShipmentResult =
  | { kind: "b2c-awb"; waybill: string; trackingUrl: string }
  | { kind: "b2b-manifest"; jobId: string; alreadySubmitted: boolean };

export interface PickupOutcome {
  channel: DelhiveryChannel;
  pickupDate: string;
  pickupTime: string;
  packageCount: number;
  pickupId: string | null;
}

/**
 * Common surface of the two Delhivery clients. Both take the order id (not a
 * loaded order) because each re-reads the order under its own lock.
 * B2C talks to track.delhivery.com (static token); B2B to ltl-clients-api
 * (JWT from /ums/login). They never share a token, base URL or payload.
 */
export interface DelhiveryProvider {
  readonly channel: DelhiveryChannel;
  createShipment(orderId: string): Promise<ShipmentResult>;
  requestPickup(orderId: string): Promise<PickupOutcome>;
  registerWarehouse(): Promise<never>;
}

/** Order.channel decides which module runs. */
export function getProvider(channel: DelhiveryChannel): DelhiveryProvider {
  return channel === "B2B" ? b2bProvider : b2cProvider;
}

export async function getProviderForOrder(orderId: string): Promise<DelhiveryProvider> {
  const order = await prisma.order.findUnique({ where: { id: orderId }, select: { channel: true } });
  if (!order) throw new Error(`Order ${orderId} not found`);
  return getProvider(toDelhiveryChannel(order.channel));
}

export async function createShipmentForOrder(orderId: string): Promise<ShipmentResult> {
  return (await getProviderForOrder(orderId)).createShipment(orderId);
}
