import { describe, it, expect, vi, beforeEach, afterEach } from "vitest";

import { createPickupRequestStore } from "./test-support/pickup-request-store";

const store = createPickupRequestStore();
const pickupRequest = store.pickupRequest;
vi.mock("@/lib/prisma", () => ({
  prisma: {
    pickupRequest: {
      create: (...a: unknown[]) => (store.pickupRequest.create as (...x: unknown[]) => unknown)(...a),
      findUnique: (...a: unknown[]) => (store.pickupRequest.findUnique as (...x: unknown[]) => unknown)(...a),
      update: (...a: unknown[]) => (store.pickupRequest.update as (...x: unknown[]) => unknown)(...a),
      updateMany: (...a: unknown[]) => (store.pickupRequest.updateMany as (...x: unknown[]) => unknown)(...a),
      deleteMany: (...a: unknown[]) => (store.pickupRequest.deleteMany as (...x: unknown[]) => unknown)(...a),
    },
  },
}));

const { bookPickupOncePerDay, PICKUP_CLAIM_STALE_MS } = await import("./pickup-day");

const SLOT = { pickupDate: "2026-11-02", pickupTime: "16:00:00" };
const book = (send: () => Promise<{ packageCount: number; pickupId: string | null; alreadyScheduled?: boolean }>, over: Partial<{ channel: "B2C" | "B2B"; warehouse: string; pickupDate: string }> = {}) =>
  bookPickupOncePerDay({ channel: "B2C", warehouse: "WH", ...SLOT, ...over, send });

beforeEach(() => {
  store.reset();
  vi.clearAllMocks();
  vi.useFakeTimers();
  vi.setSystemTime(new Date("2026-11-02T04:00:00Z"));
});
afterEach(() => {
  vi.useRealTimers();
});

describe("bookPickupOncePerDay", () => {
  it("two orders from one warehouse on one day -> the pickup is sent ONCE", async () => {
    const send = vi.fn(async () => ({ packageCount: 2, pickupId: "p1" }));

    const first = await book(send); // order 1
    const second = await book(send); // order 2

    expect(send).toHaveBeenCalledTimes(1);
    expect(first).toMatchObject({ alreadyOpen: false, packageCount: 2, pickupId: "p1" });
    expect(second).toMatchObject({ alreadyOpen: true, packageCount: 2, pickupId: "p1" });
    expect(store.rows).toHaveLength(1);
    expect(store.rows[0]).toMatchObject({ status: "REQUESTED", packageCount: 2, pickupId: "p1" });
  });

  it("two orders arriving at the same moment still send only ONE request", async () => {
    let release!: () => void;
    const gate = new Promise<void>((r) => (release = r));
    const send = vi.fn(async () => {
      await gate; // the winner is still mid-request while the other order arrives
      return { packageCount: 2, pickupId: "p1" };
    });

    const both = Promise.all([book(send), book(send)]);
    await vi.advanceTimersByTimeAsync(0);
    release();
    const [a, b] = await both;

    expect(send).toHaveBeenCalledTimes(1);
    expect([a.alreadyOpen, b.alreadyOpen].sort()).toEqual([false, true]);
  });

  it("a different warehouse, a different channel, or a different day each get their own pickup", async () => {
    const send = vi.fn(async () => ({ packageCount: 1, pickupId: null }));

    await book(send);
    await book(send, { warehouse: "OTHER" });
    await book(send, { channel: "B2B" }); // same warehouse NAME, different Delhivery client
    await book(send, { pickupDate: "2026-11-03" });

    expect(send).toHaveBeenCalledTimes(4);
    expect(store.rows).toHaveLength(4);
  });

  it("if Delhivery says a request already exists, that counts as open (recorded, not a failure)", async () => {
    const r = await book(async () => ({ packageCount: 4, pickupId: null, alreadyScheduled: true }));
    expect(r.alreadyOpen).toBe(true);
    expect(store.rows[0].status).toBe("REQUESTED");
    const again = vi.fn();
    await book(again);
    expect(again).not.toHaveBeenCalled();
  });

  it("a failed send releases the claim, so the NEXT order retries instead of the day staying unbooked", async () => {
    const failing = vi.fn(async () => {
      throw new Error("Delhivery down");
    });
    await expect(book(failing)).rejects.toThrow("Delhivery down");
    expect(store.rows).toHaveLength(0);

    const ok = vi.fn(async () => ({ packageCount: 1, pickupId: "p2" }));
    const r = await book(ok);
    expect(ok).toHaveBeenCalledTimes(1);
    expect(r.alreadyOpen).toBe(false);
  });

  it("a fresh PENDING claim (another order mid-send) is respected, not retaken", async () => {
    store.rows.push({ id: "pr_x", channel: "B2C", warehouse: "WH", ...SLOT, status: "PENDING", packageCount: null, pickupId: null, createdAt: new Date(), updatedAt: new Date() });
    const send = vi.fn();
    const r = await book(send);
    expect(send).not.toHaveBeenCalled();
    expect(r.alreadyOpen).toBe(true);
  });

  it("an abandoned PENDING claim (claimer crashed) is taken over after the stale window", async () => {
    store.rows.push({ id: "pr_x", channel: "B2C", warehouse: "WH", ...SLOT, status: "PENDING", packageCount: null, pickupId: null, createdAt: new Date(), updatedAt: new Date() });
    vi.setSystemTime(Date.now() + PICKUP_CLAIM_STALE_MS + 1000);

    const send = vi.fn(async () => ({ packageCount: 3, pickupId: "p3" }));
    const r = await book(send);

    expect(send).toHaveBeenCalledTimes(1);
    expect(r).toMatchObject({ alreadyOpen: false, packageCount: 3 });
    expect(store.rows[0]).toMatchObject({ id: "pr_x", status: "REQUESTED", packageCount: 3 });
  });

  it("a non-unique-constraint DB error is not mistaken for 'already open'", async () => {
    pickupRequest.create.mockRejectedValueOnce(new Error("connection reset"));
    const send = vi.fn();
    await expect(book(send)).rejects.toThrow("connection reset");
    expect(send).not.toHaveBeenCalled();
  });
});
