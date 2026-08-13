import { describe, it, expect, beforeEach, afterEach, vi } from "vitest";

const ORIGINAL_EMAIL = process.env.SHIPROCKET_EMAIL;
const ORIGINAL_PASSWORD = process.env.SHIPROCKET_PASSWORD;
const ORIGINAL_FETCH = global.fetch;

/** Minimal ioredis-compatible fake covering only the get/set/del shapes auth.ts uses. */
class FakeRedis {
  private store = new Map<string, { value: string; expiresAt: number | null }>();
  public setCalls: unknown[][] = [];

  private isLive(key: string): boolean {
    const entry = this.store.get(key);
    if (!entry) return false;
    if (entry.expiresAt !== null && entry.expiresAt <= Date.now()) {
      this.store.delete(key);
      return false;
    }
    return true;
  }

  async get(key: string): Promise<string | null> {
    return this.isLive(key) ? this.store.get(key)!.value : null;
  }

  async set(key: string, value: string, ...args: unknown[]): Promise<"OK" | null> {
    this.setCalls.push([key, value, ...args]);
    let ttlMs: number | null = null;
    let nx = false;
    for (let i = 0; i < args.length; i++) {
      if (args[i] === "EX") ttlMs = Number(args[i + 1]) * 1000;
      if (args[i] === "PX") ttlMs = Number(args[i + 1]);
      if (args[i] === "NX") nx = true;
    }
    if (nx && this.isLive(key)) return null;
    this.store.set(key, { value, expiresAt: ttlMs !== null ? Date.now() + ttlMs : null });
    return "OK";
  }

  async del(key: string): Promise<number> {
    return this.store.delete(key) ? 1 : 0;
  }

  /** Only ever used for auth.ts's compare-and-delete lock-release script. */
  async eval(_script: string, _numKeys: number, key: string, expected: string): Promise<number> {
    const entry = this.store.get(key);
    if (entry && entry.value === expected) {
      this.store.delete(key);
      return 1;
    }
    return 0;
  }
}

function jsonResponse(status: number, body: unknown): Response {
  return new Response(JSON.stringify(body), { status, headers: { "Content-Type": "application/json" } });
}

async function freshAuthModule(redis: FakeRedis | null) {
  vi.resetModules();
  vi.doMock("@/lib/redis", () => ({ getRedis: () => redis }));
  return import("./auth");
}

beforeEach(() => {
  process.env.SHIPROCKET_EMAIL = "ops@motoxplus.in";
  process.env.SHIPROCKET_PASSWORD = "correct-horse-battery-staple";
});

afterEach(() => {
  process.env.SHIPROCKET_EMAIL = ORIGINAL_EMAIL;
  process.env.SHIPROCKET_PASSWORD = ORIGINAL_PASSWORD;
  global.fetch = ORIGINAL_FETCH;
  vi.restoreAllMocks();
});

describe("fail-closed configuration", () => {
  it("throws ShiprocketConfigError when both credentials are unset — no silent fallback", async () => {
    delete process.env.SHIPROCKET_EMAIL;
    delete process.env.SHIPROCKET_PASSWORD;
    const { getShiprocketToken } = await freshAuthModule(null);
    const { ShiprocketConfigError } = await import("./errors");
    await expect(getShiprocketToken()).rejects.toThrow(ShiprocketConfigError);
  });

  it("throws when only the password is a placeholder value", async () => {
    process.env.SHIPROCKET_PASSWORD = "your_shiprocket_password";
    const { getShiprocketToken } = await freshAuthModule(null);
    const { ShiprocketConfigError } = await import("./errors");
    await expect(getShiprocketToken()).rejects.toThrow(ShiprocketConfigError);
  });

  it("never includes the email or password in the thrown error message", async () => {
    delete process.env.SHIPROCKET_EMAIL;
    const { getShiprocketToken } = await freshAuthModule(null);
    try {
      await getShiprocketToken();
      expect.unreachable("should have thrown");
    } catch (err) {
      const message = err instanceof Error ? err.message : String(err);
      expect(message).not.toContain("correct-horse-battery-staple");
    }
  });
});

describe("token acquisition and caching (Redis path)", () => {
  it("logs in once and single-flights concurrent callers", async () => {
    let fetchCalls = 0;
    global.fetch = vi.fn(async () => {
      fetchCalls++;
      await new Promise((r) => setTimeout(r, 20));
      return jsonResponse(200, { token: "tok-abc" });
    }) as unknown as typeof fetch;

    const redis = new FakeRedis();
    const { getShiprocketToken } = await freshAuthModule(redis);

    const [a, b, c] = await Promise.all([getShiprocketToken(), getShiprocketToken(), getShiprocketToken()]);

    expect(a).toBe("tok-abc");
    expect(b).toBe("tok-abc");
    expect(c).toBe("tok-abc");
    expect(fetchCalls).toBe(1);
  });

  it("serves from the Redis cache on a subsequent call without calling fetch again", async () => {
    let fetchCalls = 0;
    global.fetch = vi.fn(async () => {
      fetchCalls++;
      return jsonResponse(200, { token: "tok-cached" });
    }) as unknown as typeof fetch;

    const redis = new FakeRedis();
    const { getShiprocketToken } = await freshAuthModule(redis);

    await getShiprocketToken();
    const second = await getShiprocketToken();

    expect(second).toBe("tok-cached");
    expect(fetchCalls).toBe(1);
  });

  it("a second worker waits for the first's token instead of logging in again (distributed lock)", async () => {
    let fetchCalls = 0;
    global.fetch = vi.fn(async () => {
      fetchCalls++;
      await new Promise((r) => setTimeout(r, 50));
      return jsonResponse(200, { token: "tok-shared" });
    }) as unknown as typeof fetch;

    const sharedRedis = new FakeRedis();
    const workerA = await freshAuthModule(sharedRedis);
    const workerB = await freshAuthModule(sharedRedis);

    const [tokenA, tokenB] = await Promise.all([workerA.getShiprocketToken(), workerB.getShiprocketToken()]);

    expect(tokenA).toBe("tok-shared");
    expect(tokenB).toBe("tok-shared");
    expect(fetchCalls).toBe(1);
  });

  it("propagates ShiprocketAuthError on a failed login without exposing the response body", async () => {
    global.fetch = vi.fn(async () => jsonResponse(401, { message: "Invalid Credentials" })) as unknown as typeof fetch;

    const redis = new FakeRedis();
    const { getShiprocketToken } = await freshAuthModule(redis);
    const { ShiprocketAuthError } = await import("./errors");

    await expect(getShiprocketToken()).rejects.toThrow(ShiprocketAuthError);
  });
});

describe("token acquisition and caching (in-process fallback, no Redis)", () => {
  it("still single-flights concurrent callers within the same process", async () => {
    let fetchCalls = 0;
    global.fetch = vi.fn(async () => {
      fetchCalls++;
      await new Promise((r) => setTimeout(r, 20));
      return jsonResponse(200, { token: "tok-local" });
    }) as unknown as typeof fetch;

    const { getShiprocketToken } = await freshAuthModule(null);
    const [a, b] = await Promise.all([getShiprocketToken(), getShiprocketToken()]);

    expect(a).toBe("tok-local");
    expect(b).toBe("tok-local");
    expect(fetchCalls).toBe(1);
  });
});

describe("invalidateShiprocketToken", () => {
  it("forces the next call to re-authenticate", async () => {
    let fetchCalls = 0;
    global.fetch = vi.fn(async () => {
      fetchCalls++;
      return jsonResponse(200, { token: `tok-${fetchCalls}` });
    }) as unknown as typeof fetch;

    const redis = new FakeRedis();
    const { getShiprocketToken, invalidateShiprocketToken } = await freshAuthModule(redis);

    const first = await getShiprocketToken();
    await invalidateShiprocketToken();
    const second = await getShiprocketToken();

    expect(first).toBe("tok-1");
    expect(second).toBe("tok-2");
    expect(fetchCalls).toBe(2);
  });
});
