import { describe, it, expect, vi, beforeEach, afterEach } from "vitest";
import { getB2bToken, resetB2bAuthState, B2B_TOKEN_CACHE_MS, B2B_LOGIN_LOCK_MS } from "./auth";
import { DelhiveryB2bAuthError, DelhiveryB2bAuthLockedError, DelhiveryNotSpecifiedError } from "../errors";

// Every HTTP call is mocked. All credential/token values are dummy test strings.

const fetchMock = vi.fn();
const ENV = { ...process.env };
const HOUR = 60 * 60 * 1000;

function res(status: number, body: unknown = {}) {
  return new Response(typeof body === "string" ? body : JSON.stringify(body), { status });
}

beforeEach(() => {
  vi.useFakeTimers();
  vi.setSystemTime(new Date("2026-11-01T00:00:00Z"));
  vi.stubGlobal("fetch", fetchMock);
  fetchMock.mockReset();
  resetB2bAuthState();
  Object.assign(process.env, {
    DELHIVERY_B2B_USERNAME: "test-user",
    DELHIVERY_B2B_PASSWORD: "test-pass",
    DELHIVERY_B2B_TOKEN_FIELD: "jwt",
    DELHIVERY_PICKUP_LOCATION_B2B: "WH-B2B",
  });
  delete process.env.DELHIVERY_B2B_BASE_URL;
});
afterEach(() => {
  vi.useRealTimers();
  vi.unstubAllGlobals();
  process.env = { ...ENV };
});

describe("B2B login", () => {
  it("POSTs JSON {username,password} to /ums/login on the LTL host (never track.delhivery.com)", async () => {
    fetchMock.mockResolvedValue(res(200, { jwt: "tok-1" }));

    expect(await getB2bToken()).toBe("tok-1");

    const [url, init] = fetchMock.mock.calls[0];
    expect(url).toBe("https://ltl-clients-api.delhivery.com/ums/login");
    expect(init.method).toBe("POST");
    expect(init.headers["Content-Type"]).toBe("application/json");
    expect(JSON.parse(init.body)).toEqual({ username: "test-user", password: "test-pass" });
    for (const [u] of fetchMock.mock.calls) expect(String(u)).not.toContain("track.delhivery.com");
  });

  it("supports a dotted token path", async () => {
    process.env.DELHIVERY_B2B_TOKEN_FIELD = "data.jwt";
    fetchMock.mockResolvedValue(res(200, { data: { jwt: "tok-nested" } }));
    expect(await getB2bToken()).toBe("tok-nested");
  });
});

describe("B2B token cache (23h)", () => {
  it("logs in once and serves the cached JWT", async () => {
    fetchMock.mockResolvedValue(res(200, { jwt: "tok-1" }));

    await getB2bToken();
    vi.setSystemTime(Date.now() + 22 * HOUR);
    expect(await getB2bToken()).toBe("tok-1");

    expect(fetchMock).toHaveBeenCalledTimes(1);
  });

  it("logs in again once 23h have passed", async () => {
    fetchMock.mockResolvedValueOnce(res(200, { jwt: "tok-1" })).mockResolvedValueOnce(res(200, { jwt: "tok-2" }));

    await getB2bToken();
    vi.setSystemTime(Date.now() + B2B_TOKEN_CACHE_MS + 1);

    expect(await getB2bToken()).toBe("tok-2");
    expect(fetchMock).toHaveBeenCalledTimes(2);
  });

  it("concurrent callers share one login", async () => {
    fetchMock.mockResolvedValue(res(200, { jwt: "tok-1" }));
    const tokens = await Promise.all([getB2bToken(), getB2bToken(), getB2bToken()]);
    expect(tokens).toEqual(["tok-1", "tok-1", "tok-1"]);
    expect(fetchMock).toHaveBeenCalledTimes(1);
  });
});

describe("unknown token shape", () => {
  it("errors clearly (listing key NAMES only) when DELHIVERY_B2B_TOKEN_FIELD is not set", async () => {
    delete process.env.DELHIVERY_B2B_TOKEN_FIELD;
    fetchMock.mockResolvedValue(res(200, { access: "secret-value-123", expires: 99 }));

    const err = await getB2bToken().catch((e) => e);

    expect(err).toBeInstanceOf(DelhiveryNotSpecifiedError);
    expect(err.message).toContain("DELHIVERY_B2B_TOKEN_FIELD");
    expect(err.message).toContain("access, expires");
    expect(err.message).not.toContain("secret-value-123");
  });

  it("errors clearly when the configured field is absent from the response", async () => {
    fetchMock.mockResolvedValue(res(200, { somethingElse: "x" }));
    const err = await getB2bToken().catch((e) => e);
    expect(err).toBeInstanceOf(DelhiveryNotSpecifiedError);
    expect(err.message).toContain('"jwt"');
    expect(err.message).toContain("somethingElse");
  });

  it("does not cache a login whose token could not be read", async () => {
    fetchMock.mockResolvedValueOnce(res(200, {})).mockResolvedValueOnce(res(200, { jwt: "tok-ok" }));
    await expect(getB2bToken()).rejects.toBeInstanceOf(DelhiveryNotSpecifiedError);
    expect(await getB2bToken()).toBe("tok-ok");
  });
});

describe("wrong credentials: 10 minute lock, no retry loop", () => {
  it("makes exactly one request, then refuses to call the network for 10 minutes", async () => {
    fetchMock.mockResolvedValue(res(401, { detail: "bad credentials" }));

    await expect(getB2bToken()).rejects.toBeInstanceOf(DelhiveryB2bAuthError);
    expect(fetchMock).toHaveBeenCalledTimes(1); // no retry inside the call

    vi.setSystemTime(Date.now() + B2B_LOGIN_LOCK_MS - 1000);
    await expect(getB2bToken()).rejects.toBeInstanceOf(DelhiveryB2bAuthLockedError);
    await expect(getB2bToken()).rejects.toBeInstanceOf(DelhiveryB2bAuthLockedError);
    expect(fetchMock).toHaveBeenCalledTimes(1); // still no extra login attempts
  });

  it("allows one new attempt after the lock expires", async () => {
    fetchMock.mockResolvedValueOnce(res(401)).mockResolvedValueOnce(res(200, { jwt: "tok-after" }));

    await expect(getB2bToken()).rejects.toBeInstanceOf(DelhiveryB2bAuthError);
    vi.setSystemTime(Date.now() + B2B_LOGIN_LOCK_MS + 1);

    expect(await getB2bToken()).toBe("tok-after");
    expect(fetchMock).toHaveBeenCalledTimes(2);
  });

  it("a 5xx (their outage, not our credentials) does not lock", async () => {
    fetchMock.mockResolvedValueOnce(res(503, "down")).mockResolvedValueOnce(res(200, { jwt: "tok-1" }));

    await expect(getB2bToken()).rejects.toBeInstanceOf(DelhiveryB2bAuthError);
    expect(await getB2bToken()).toBe("tok-1");
  });

  it("a network failure does not lock either", async () => {
    fetchMock.mockRejectedValueOnce(new Error("ECONNRESET")).mockResolvedValueOnce(res(200, { jwt: "tok-1" }));

    await expect(getB2bToken()).rejects.toThrow(/login request failed/);
    expect(await getB2bToken()).toBe("tok-1");
  });
});
