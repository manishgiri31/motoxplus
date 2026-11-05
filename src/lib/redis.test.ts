import { EventEmitter } from "node:events";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

// A stand-in for the ioredis client: just the surface checkRedis() touches.
class FakeRedis extends EventEmitter {
  status = "connecting";
  ping = vi.fn<() => Promise<string>>();
}

const created: FakeRedis[] = [];

vi.mock("ioredis", () => ({
  default: vi.fn().mockImplementation(function () {
    const r = new FakeRedis();
    created.push(r);
    return r;
  }),
}));

async function load() {
  vi.resetModules(); // getRedis() caches its client at module level; each test needs a fresh one
  return import("./redis");
}

describe("checkRedis", () => {
  const originalUrl = process.env.REDIS_URL;

  beforeEach(() => {
    created.length = 0;
    vi.spyOn(console, "error").mockImplementation(() => {});
  });

  afterEach(() => {
    vi.restoreAllMocks();
    if (originalUrl === undefined) delete process.env.REDIS_URL;
    else process.env.REDIS_URL = originalUrl;
  });

  it("reports 'disabled' (not an error) when REDIS_URL is unset", async () => {
    delete process.env.REDIS_URL;
    const { checkRedis } = await load();
    expect(await checkRedis()).toEqual({ status: "disabled" });
    expect(created).toHaveLength(0);
  });

  it("reports ok with latency after a real PONG", async () => {
    process.env.REDIS_URL = "redis://example:6379";
    const { checkRedis } = await load();
    const redis = (await import("./redis")).getRedis() as unknown as FakeRedis;
    redis.status = "ready";
    redis.ping.mockResolvedValue("PONG");

    const res = await checkRedis();
    expect(res.status).toBe("ok");
    expect(res.status === "ok" && res.latencyMs).toBeGreaterThanOrEqual(0);
    expect(redis.ping).toHaveBeenCalledTimes(1);
  });

  it("waits for a client that is still handshaking instead of calling a healthy Redis 'down'", async () => {
    process.env.REDIS_URL = "redis://example:6379";
    const { checkRedis, getRedis } = await load();
    const redis = getRedis() as unknown as FakeRedis;
    redis.ping.mockResolvedValue("PONG");
    setTimeout(() => {
      redis.status = "ready";
      redis.emit("ready");
    }, 30);

    expect((await checkRedis(1000)).status).toBe("ok");
  });

  it("reports an error with a timeout reason when Redis never becomes ready, and leaks no listener", async () => {
    process.env.REDIS_URL = "redis://example:6379";
    const { checkRedis, getRedis } = await load();
    const redis = getRedis() as unknown as FakeRedis;

    const res = await checkRedis(40);
    expect(res).toMatchObject({ status: "error", reason: "timeout" });
    expect(redis.ping).not.toHaveBeenCalled();
    expect(redis.listenerCount("ready")).toBe(0); // every health poll used to leak one while Redis was down
  });

  it("reports an error when PING itself rejects", async () => {
    process.env.REDIS_URL = "redis://example:6379";
    const { checkRedis, getRedis } = await load();
    const redis = getRedis() as unknown as FakeRedis;
    redis.status = "ready";
    redis.ping.mockRejectedValue(new Error("Command timed out"));

    expect(await checkRedis()).toMatchObject({ status: "error", reason: "unreachable" });
  });

  it("reports an error on an unexpected PING reply", async () => {
    process.env.REDIS_URL = "redis://example:6379";
    const { checkRedis, getRedis } = await load();
    const redis = getRedis() as unknown as FakeRedis;
    redis.status = "ready";
    redis.ping.mockResolvedValue("NOPE");

    expect(await checkRedis()).toMatchObject({ status: "error", reason: "unexpected-reply" });
  });

  it("never exposes hostnames or error text in the result (the health endpoint is public)", async () => {
    process.env.REDIS_URL = "redis://secret-host.internal:6379";
    const { checkRedis, getRedis } = await load();
    const redis = getRedis() as unknown as FakeRedis;
    redis.status = "ready";
    redis.ping.mockRejectedValue(new Error("connect ECONNREFUSED 10.0.0.5:6379 (secret-host.internal)"));

    const res = await checkRedis();
    expect(JSON.stringify(res)).not.toMatch(/secret-host|10\.0\.0\.5|ECONNREFUSED/);
  });
});
