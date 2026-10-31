import { vi } from "vitest";
import { Prisma } from "@prisma/client";

/**
 * Test-only, in-memory stand-in for the PickupRequest table, including its
 * unique key (channel + warehouse + pickupDate) — the thing that makes "one
 * pickup per warehouse per day" safe. Not imported by app code.
 */
export type PickupRow = {
  id: string;
  channel: string;
  warehouse: string;
  pickupDate: string;
  pickupTime: string;
  status: "PENDING" | "REQUESTED";
  packageCount: number | null;
  pickupId: string | null;
  createdAt: Date;
  updatedAt: Date;
};

const keyOf = (r: { channel: string; warehouse: string; pickupDate: string }) => `${r.channel}|${r.warehouse}|${r.pickupDate}`;

export function createPickupRequestStore() {
  const state = { rows: [] as PickupRow[], seq: 0 };

  const pickupRequest = {
    create: vi.fn(async ({ data }: { data: Pick<PickupRow, "channel" | "warehouse" | "pickupDate" | "pickupTime"> }) => {
      if (state.rows.some((r) => keyOf(r) === keyOf(data))) {
        throw new Prisma.PrismaClientKnownRequestError("Unique constraint failed", { code: "P2002", clientVersion: "6.x" });
      }
      const row: PickupRow = {
        id: `pr_${++state.seq}`,
        ...data,
        status: "PENDING",
        packageCount: null,
        pickupId: null,
        createdAt: new Date(),
        updatedAt: new Date(),
      };
      state.rows.push(row);
      return row;
    }),
    findUnique: vi.fn(
      async ({ where }: { where: { channel_warehouse_pickupDate: { channel: string; warehouse: string; pickupDate: string } } }) =>
        state.rows.find((r) => keyOf(r) === keyOf(where.channel_warehouse_pickupDate)) ?? null
    ),
    update: vi.fn(async ({ where, data }: { where: { id: string }; data: Partial<PickupRow> }) => {
      const row = state.rows.find((r) => r.id === where.id)!;
      Object.assign(row, data, { updatedAt: new Date() });
      return row;
    }),
    updateMany: vi.fn(
      async ({ where, data }: { where: { id: string; status: string; updatedAt: { lt: Date } }; data: Partial<PickupRow> }) => {
        const hit = state.rows.filter((r) => r.id === where.id && r.status === where.status && r.updatedAt < where.updatedAt.lt);
        hit.forEach((r) => Object.assign(r, data, { updatedAt: new Date() }));
        return { count: hit.length };
      }
    ),
    deleteMany: vi.fn(async ({ where }: { where: { id: string; status: string } }) => {
      const before = state.rows.length;
      state.rows = state.rows.filter((r) => !(r.id === where.id && r.status === where.status));
      return { count: before - state.rows.length };
    }),
  };

  return {
    pickupRequest,
    get rows() {
      return state.rows;
    },
    reset() {
      state.rows = [];
      state.seq = 0;
    },
  };
}
