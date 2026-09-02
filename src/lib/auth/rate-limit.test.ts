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

  it("falls open to in-memory when Redis is ready but the command itself throws (a mid-connection blip, not a cold start)", async () => {
    fakeRedis = new FakeRedis(null);
    fakeRedis.status = "ready";
    fakeRedis.eval = async () => { throw new Error("READONLY You can't write against a read only replica."); };
    const { checkRateLimit } = await import("./rate-limit");

    const result = await checkRateLimit("test:key:blip", { max: 5, windowSeconds: 60, failMode: "open" });
    expect(result.allowed).toBe(true);
  });

  it("does not leak a 'ready' listener per call while Redis is unreachable (F-26)", async () => {
    fakeRedis = new FakeRedis(null); // never becomes ready → every call takes the timeout path
    const { checkRateLimit, peekRateLimit, resetRateLimit } = await import("./rate-limit");

    for (let i = 0; i < 3; i++) {
      await checkRateLimit(`f26:${i}`, { max: 5, windowSeconds: 60, failMode: "open" });
      await peekRateLimit(`f26:${i}`, { max: 5, windowSeconds: 60 });
      await resetRateLimit(`f26:${i}`);
    }

    // Before the fix: 9 accumulated once("ready") listeners (one per waitForReady
    // call) that never get removed because "ready" never fires. After: the
    // timeout path removes its own listener, so none accumulate.
    expect(fakeRedis.listenerCount("ready")).toBe(0);
  }, 15000);
});

describe("checkRateLimit / peekRateLimit — key isolation and window behavior (in-memory backend)", () => {
  it("two different keys never share a bucket", async () => {
    fakeRedis = null; // getRedis() returns null -> in-memory path
    const { checkRateLimit } = await import("./rate-limit");

    for (let i = 0; i < 5; i++) {
      await checkRateLimit("isolation:key-a", { max: 5, windowSeconds: 60 });
    }
    const keyABlocked = await checkRateLimit("isolation:key-a", { max: 5, windowSeconds: 60 });
    expect(keyABlocked.allowed).toBe(false);

    // A completely different key must start from zero, not inherit key-a's count.
    const keyBResult = await checkRateLimit("isolation:key-b", { max: 5, windowSeconds: 60 });
    expect(keyBResult.allowed).toBe(true);
  });

  it("peekRateLimit reports blocked without incrementing — an unlimited number of peeks never trips the limit on their own", async () => {
    fakeRedis = null;
    const { peekRateLimit, checkRateLimit } = await import("./rate-limit");

    for (let i = 0; i < 50; i++) {
      const peeked = await peekRateLimit("isolation:peek-only", { max: 3, windowSeconds: 60 });
      expect(peeked.allowed).toBe(true);
    }
    // Only an actual checkRateLimit() call (a real failure, in the login
    // flow) should count against the budget.
    await checkRateLimit("isolation:peek-only", { max: 3, windowSeconds: 60 });
    const afterOneRealFailure = await peekRateLimit("isolation:peek-only", { max: 3, windowSeconds: 60 });
    expect(afterOneRealFailure.allowed).toBe(true); // 1 of 3 used, still allowed
  });

  it("resetRateLimit clears the bucket immediately, independent of the window", async () => {
    fakeRedis = null;
    const { checkRateLimit, resetRateLimit } = await import("./rate-limit");

    for (let i = 0; i < 5; i++) {
      await checkRateLimit("isolation:reset-me", { max: 5, windowSeconds: 900 });
    }
    expect((await checkRateLimit("isolation:reset-me", { max: 5, windowSeconds: 900 })).allowed).toBe(false);

    await resetRateLimit("isolation:reset-me");

    expect((await checkRateLimit("isolation:reset-me", { max: 5, windowSeconds: 900 })).allowed).toBe(true);
  });

  it("the block expires once the window elapses — a lockout is never permanent", async () => {
    fakeRedis = null;
    const { checkRateLimit } = await import("./rate-limit");

    for (let i = 0; i < 3; i++) {
      await checkRateLimit("isolation:expiring", { max: 3, windowSeconds: 1 });
    }
    expect((await checkRateLimit("isolation:expiring", { max: 3, windowSeconds: 1 })).allowed).toBe(false);

    await new Promise((r) => setTimeout(r, 1100));

    expect((await checkRateLimit("isolation:expiring", { max: 3, windowSeconds: 1 })).allowed).toBe(true);
  });
});
