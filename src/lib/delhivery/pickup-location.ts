import type { Prisma } from "@prisma/client";
import { prisma } from "@/lib/prisma";
import type { DelhiveryChannel } from "./config";

/**
 * Which Delhivery pickup location an order ships from.
 *
 * Vendor products (Product.source = VENDOR) are collected from that vendor's own warehouse
 * (DelhiveryWarehouse, set up by the Java API — Flyway V6). MotoXPlus's own products ship from the MOTOXPLUS
 * warehouse row when there is one, otherwise from the location already configured in the environment
 * (DELHIVERY_PICKUP_LOCATION_NAME / _B2B), which is what `pickupLocationName = null` means on an order.
 *
 * One order = one Delhivery shipment = one pickup location, so a cart whose items come from different
 * warehouses cannot be placed as one order; checkout asks the buyer to split it.
 */

export const OWN_LOCATION = null;

export type CheckoutPickupCode = "WAREHOUSE_NOT_ACTIVE" | "MIXED_WAREHOUSES" | "VENDOR_B2B_UNSUPPORTED";

export type CheckoutPickup =
  | { ok: true; pickupLocationName: string | null }
  | { ok: false; code: CheckoutPickupCode; error: string; productIds: string[] };

export interface CheckoutLine {
  productId: string;
  product: { source: string; vendorId: string | null };
}

type Db = Pick<Prisma.TransactionClient, "delhiveryWarehouse">;

function isVendorLine(line: CheckoutLine): line is CheckoutLine & { product: { vendorId: string } } {
  // Product.vendorId alone is NOT enough: imported/procured MotoXPlus stock also carries the supplier's vendorId.
  return line.product.source === "VENDOR" && !!line.product.vendorId;
}

/**
 * Decides the order's pickup location at checkout, or says why the cart can't be placed. Pure apart from one
 * read of DelhiveryWarehouse (pass `db` to run it inside a transaction or a test).
 */
export async function resolveCheckoutPickup(
  channel: DelhiveryChannel,
  lines: CheckoutLine[],
  db: Db = prisma
): Promise<CheckoutPickup> {
  const vendorLines = lines.filter(isVendorLine);
  const ownLines = lines.filter((l) => !isVendorLine(l));

  if (vendorLines.length > 0 && channel === "B2B") {
    // Vendor warehouses are registered on the B2C (track.delhivery.com) client only; the B2B (LTL) client
    // has no record of them, so a dealer order could only be collected from the wrong place.
    return {
      ok: false,
      code: "VENDOR_B2B_UNSUPPORTED",
      error: "Some items are sold by marketplace sellers and can't be ordered on a dealer account yet. Please remove them.",
      productIds: vendorLines.map((l) => l.productId),
    };
  }

  const vendorIds = [...new Set(vendorLines.map((l) => l.product.vendorId))];
  const rows = await db.delhiveryWarehouse.findMany({
    where: {
      OR: [
        ...(vendorIds.length > 0 ? [{ vendorId: { in: vendorIds } }] : []),
        ...(ownLines.length > 0 && channel === "B2C" ? [{ ownerType: "MOTOXPLUS" as const }] : []),
      ],
    },
    select: { ownerType: true, vendorId: true, delhiveryName: true, status: true },
  });

  // Group every line under the location it would ship from.
  const groups = new Map<string, { name: string | null; productIds: string[] }>();
  const notReady: string[] = [];
  const add = (key: string, name: string | null, productId: string) => {
    const g = groups.get(key) ?? { name, productIds: [] };
    g.productIds.push(productId);
    groups.set(key, g);
  };

  if (ownLines.length > 0) {
    const own = channel === "B2C" ? rows.find((r) => r.ownerType === "MOTOXPLUS") : undefined;
    if (own && own.status !== "ACTIVE") {
      notReady.push(...ownLines.map((l) => l.productId));
    } else {
      for (const l of ownLines) add("own", own ? own.delhiveryName : OWN_LOCATION, l.productId);
    }
  }

  for (const l of vendorLines) {
    const w = rows.find((r) => r.vendorId === l.product.vendorId);
    if (!w || w.status !== "ACTIVE") notReady.push(l.productId);
    else add(`vendor:${w.vendorId}`, w.delhiveryName, l.productId);
  }

  if (notReady.length > 0) {
    return {
      ok: false,
      code: "WAREHOUSE_NOT_ACTIVE",
      error: "Some items can't be shipped right now because the seller's pickup isn't set up. Please remove them and try again.",
      productIds: notReady,
    };
  }

  if (groups.size > 1) {
    // Everything except the largest group, so the buyer keeps as much of the cart as possible.
    const sorted = [...groups.values()].sort((a, b) => b.productIds.length - a.productIds.length);
    return {
      ok: false,
      code: "MIXED_WAREHOUSES",
      error: "These items ship from different sellers. Please order them separately.",
      productIds: sorted.slice(1).flatMap((g) => g.productIds),
    };
  }

  const only = [...groups.values()][0];
  return { ok: true, pickupLocationName: only ? only.name : OWN_LOCATION };
}

/** Where a shipment is collected from and returned to, when it is not the configured MotoXPlus location. */
export interface ShipmentOrigin {
  locationName: string;
  address: string;
  city: string;
  state: string;
  pin: string;
  phone: string;
  returnName: string;
  returnAddress: string;
  returnCity: string;
  returnState: string;
  returnPin: string;
}

/**
 * The origin for an order's pickupLocationName. null = the configured MotoXPlus location (legacy orders, or no
 * MOTOXPLUS row). Throws rather than letting a shipment be booked from a warehouse that is unknown or not ACTIVE.
 */
export async function resolveShipmentOrigin(
  pickupLocationName: string | null,
  configuredLocationName: () => string,
  db: Db = prisma
): Promise<ShipmentOrigin | null> {
  if (!pickupLocationName) return null;
  const w = await db.delhiveryWarehouse.findUnique({
    where: { delhiveryName: pickupLocationName },
    include: { vendor: { select: { companyName: true } } },
  });
  if (!w) {
    if (pickupLocationName === configuredLocationName()) return null;
    throw new Error(`Pickup location "${pickupLocationName}" is not a known warehouse — not booking a shipment from it`);
  }
  if (w.status !== "ACTIVE") {
    throw new Error(`Warehouse ${w.delhiveryName} is ${w.status}, not ACTIVE — not booking a shipment from it`);
  }
  return {
    locationName: w.delhiveryName,
    address: w.address,
    city: w.city,
    state: w.state,
    pin: w.pin,
    phone: w.phone,
    returnName: w.vendor?.companyName ?? w.delhiveryName,
    returnAddress: w.returnAddress,
    returnCity: w.returnCity,
    returnState: w.returnState,
    returnPin: w.returnPin,
  };
}
