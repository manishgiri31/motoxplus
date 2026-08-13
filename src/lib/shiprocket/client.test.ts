import { describe, it, expect, beforeEach, afterEach, vi } from "vitest";

const ORIGINAL_FETCH = global.fetch;

vi.mock("./auth", () => ({
  getShiprocketToken: vi.fn(),
  invalidateShiprocketToken: vi.fn(),
}));

function jsonResponse(status: number, body: unknown): Response {
  return new Response(JSON.stringify(body), { status, headers: { "Content-Type": "application/json" } });
}

beforeEach(() => {
  vi.resetModules();
});

afterEach(() => {
  global.fetch = ORIGINAL_FETCH;
  vi.restoreAllMocks();
});

describe("shiprocketFetch", () => {
  it("returns parsed JSON on a successful request", async () => {
    const { getShiprocketToken } = await import("./auth");
    vi.mocked(getShiprocketToken).mockResolvedValue("secret-token-1");
    global.fetch = vi.fn(async () => jsonResponse(200, { ok: true })) as unknown as typeof fetch;

    const { shiprocketFetch } = await import("./client");
    const result = await shiprocketFetch<{ ok: boolean }>("/orders/create/adhoc");

    expect(result).toEqual({ ok: true });
    expect(getShiprocketToken).toHaveBeenCalledTimes(1);
    expect(fetch).toHaveBeenCalledTimes(1);
  });

  it("never leaks the bearer token into a thrown error message", async () => {
    const { getShiprocketToken } = await import("./auth");
    vi.mocked(getShiprocketToken).mockResolvedValue("super-secret-token-xyz");
    global.fetch = vi.fn(async () => jsonResponse(500, { message: "Internal error" })) as unknown as typeof fetch;

    const { shiprocketFetch } = await import("./client");
    try {
      await shiprocketFetch("/orders/create/adhoc");
      expect.unreachable("should have thrown");
    } catch (err) {
      const message = err instanceof Error ? err.message : String(err);
      expect(message).not.toContain("super-secret-token-xyz");
    }
  });

  it("refreshes the token and retries exactly once on a 401", async () => {
    const { getShiprocketToken, invalidateShiprocketToken } = await import("./auth");
    vi.mocked(getShiprocketToken).mockResolvedValueOnce("stale-token").mockResolvedValueOnce("fresh-token");

    let call = 0;
    global.fetch = vi.fn(async () => {
      call++;
      if (call === 1) return jsonResponse(401, { message: "Unauthorized" });
      return jsonResponse(200, { ok: true, tried: call });
    }) as unknown as typeof fetch;

    const { shiprocketFetch } = await import("./client");
    const result = await shiprocketFetch<{ ok: boolean; tried: number }>("/orders/create/adhoc");

    expect(result).toEqual({ ok: true, tried: 2 });
    expect(invalidateShiprocketToken).toHaveBeenCalledTimes(1);
    expect(getShiprocketToken).toHaveBeenCalledTimes(2);
    expect(fetch).toHaveBeenCalledTimes(2);
  });

  it("fails loudly (does not retry again) if the retry also returns 401", async () => {
    const { getShiprocketToken, invalidateShiprocketToken } = await import("./auth");
    vi.mocked(getShiprocketToken).mockResolvedValue("still-bad-token");
    global.fetch = vi.fn(async () => jsonResponse(401, { message: "Unauthorized" })) as unknown as typeof fetch;

    const { shiprocketFetch } = await import("./client");
    const { ShiprocketAuthError } = await import("./errors");

    await expect(shiprocketFetch("/orders/create/adhoc")).rejects.toThrow(ShiprocketAuthError);
    expect(invalidateShiprocketToken).toHaveBeenCalledTimes(1);
    expect(fetch).toHaveBeenCalledTimes(2);
  });

  it("does not retry on non-401 errors", async () => {
    const { getShiprocketToken, invalidateShiprocketToken } = await import("./auth");
    vi.mocked(getShiprocketToken).mockResolvedValue("a-token");
    global.fetch = vi.fn(async () => jsonResponse(500, { message: "Server error" })) as unknown as typeof fetch;

    const { shiprocketFetch } = await import("./client");
    const { ShiprocketAuthError } = await import("./errors");

    await expect(shiprocketFetch("/orders/create/adhoc")).rejects.toThrow(ShiprocketAuthError);
    expect(invalidateShiprocketToken).not.toHaveBeenCalled();
    expect(fetch).toHaveBeenCalledTimes(1);
  });
});
