import { describe, it, expect, afterEach, vi } from "vitest";
import { EventEmitter } from "events";

/**
 * Minimal ioredis-compatible fake that reproduces the real bug: a command
 * issued while `status` isn't yet "ready" throws immediately, exactly like
 * ioredis does with enableOfflineQueue:false. `becomeReadyAfterMs` lets each
 * test control how long the (simulated) handshake takes.
 */
class FakeRedis extends EventEmitter {
  status: string = "connecting";
  evalCalls = 0;

  constructor(becomeReadyAfterMs: number | null) {
    super();
    if (becomeReadyAfterMs !== null) {
      setTimeout(() => {
        this.status = "ready";
        this.emit("ready");
      }, becomeReadyAfterMs);
    }
  }

  async eval(): Promise<number> {
    this.evalCalls++;
    if (this.status !== "ready") {
      throw new Error("Stream isn't writeable and enableOfflineQueue options is false");
    }
    return 1; // first request in the window
  }
}

let fakeRedis: FakeRedis | null = null;

vi.mock("@/lib/redis", () => ({
  getRedis: () => fakeRedis,
}));

afterEach(() => {
  fakeRedis = null;
  vi.restoreAllMocks();
});

describe("checkRateLimit — cold-start Redis connection race", () => {
  it("waits for the client to become ready instead of failing closed on the first request after a cold start", async () => {
    fakeRedis = new FakeRedis(50); // becomes ready 50ms in — well inside the wait window
    const { checkRateLimit } = await import("./rate-limit");

    const result = await checkRateLimit("test:key", { max: 5, windowSeconds: 60, failMode: "closed" });

    expect(result.allowed).toBe(true);
    expect(fakeRedis.evalCalls).toBe(1); // no wasted eval() attempt before it was ready
  });

  it("does not wait at all when the client is already ready (no added latency on the warm path)", async () => {
    fakeRedis = new FakeRedis(null);
    fakeRedis.status = "ready";
    const { checkRateLimit } = await import("./rate-limit");

    const start = Date.now();
    const result = await checkRateLimit("test:key", { max: 5, windowSeconds: 60, failMode: "closed" });
    const elapsed = Date.now() - start;

    expect(result.allowed).toBe(true);
    expect(elapsed).toBeLessThan(50);
  });

  it("still fails closed (bounded wait, not an indefinite hang) when Redis never becomes ready — a genuine outage", async () => {
    fakeRedis = new FakeRedis(null); // never emits "ready"
    const { checkRateLimit } = await import("./rate-limit");

    const start = Date.now();
    const result = await checkRateLimit("test:key", { max: 5, windowSeconds: 60, failMode: "closed" });
    const elapsed = Date.now() - start;

    expect(result.allowed).toBe(false);
    expect(elapsed).toBeLessThan(1000); // bounded by the wait window, not hung
  });

  it("still fails open (falls back to in-memory) when Redis never becomes ready and failMode is 'open'", async () => {
    fakeRedis = new FakeRedis(null);
    const { checkRateLimit } = await import("./rate-limit");

    const result = await checkRateLimit("test:key:open", { max: 5, windowSeconds: 60, failMode: "open" });
    expect(result.allowed).toBe(true); // in-memory fallback allows the first request
  });
});
