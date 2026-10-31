import { describe, it, expect, vi, beforeEach, afterEach } from "vitest";
import { getB2bToken, resetB2bAuthState, B2B_TOKEN_REFRESH_MARGIN_MS, B2B_LOGIN_LOCK_MS } from "./auth";
import { DelhiveryB2bAuthError, DelhiveryB2bAuthLockedError, DelhiveryNotSpecifiedError } from "../errors";

// Every HTTP call is mocked. All credential/token values are dummy test strings.

const fetchMock = vi.fn();
const ENV = { ...process.env };
const NOW = new Date("2026-11-01T00:00:00Z");
const MIN = 60 * 1000;
const HOUR = 60 * MIN;

const b64 = (o: unknown) => Buffer.from(JSON.stringify(o)).toString("base64url");
/** A structurally valid JWT (unsigned) whose `exp` is `expiresInMs` from NOW. */
const jwt = (expiresInMs: number, tag = "a") =>
  `${b64({ alg: "none" })}.${b64({ exp: Math.floor((NOW.getTime() + expiresInMs) / 1000), tag })}.sig`;

function res(status: number, body: unknown = {}) {
  return new Response(typeof body === "string" ? body : JSON.stringify(body), { status });
}
const loginOk = (token: string) => res(200, { data: { jwt: token } });

beforeEach(() => {
  vi.useFakeTimers();
  vi.setSystemTime(NOW);
  vi.stubGlobal("fetch", fetchMock);
  fetchMock.mockReset();
  resetB2bAuthState();
  Object.assign(process.env, {
    DELHIVERY_USERNAME_B2B: "test-user",
    DELHIVERY_PASSWORD_B2B: "test-pass",
    DELHIVERY_PICKUP_LOCATION_B2B: "WH-B2B",
  });
  delete process.env.DELHIVERY_B2B_BASE_URL;
});
afterEach(() => {
  vi.useRealTimers();
  vi.unstubAllGlobals();
  vi.restoreAllMocks();
  process.env = { ...ENV };
});

describe("B2B login", () => {
  it("POSTs JSON {username,password} to /ums/login on the LTL host and reads data.jwt", async () => {
    const token = jwt(24 * HOUR);
    fetchMock.mockResolvedValue(loginOk(token));

    expect(await getB2bToken()).toBe(token);

    const [url, init] = fetchMock.mock.calls[0];
    expect(url).toBe("https://ltl-clients-api.delhivery.com/ums/login");
    expect(init.method).toBe("POST");
    expect(init.headers["Content-Type"]).toBe("application/json");
    expect(JSON.parse(init.body)).toEqual({ username: "test-user", password: "test-pass" });
  });

  it("never sends anything to track.delhivery.com", async () => {
    fetchMock.mockResolvedValue(loginOk(jwt(24 * HOUR)));
    await getB2bToken();
    for (const [u] of fetchMock.mock.calls) expect(String(u)).not.toContain("track.delhivery.com");
  });
});

describe("B2B token cache — expires at JWT exp minus 5 minutes", () => {
  it("reuses the cached JWT before the refresh point", async () => {
    fetchMock.mockImplementation(async () => loginOk(jwt(24 * HOUR)));

    await getB2bToken();
    vi.setSystemTime(NOW.getTime() + 24 * HOUR - B2B_TOKEN_REFRESH_MARGIN_MS - 1000);
    await getB2bToken();

    expect(fetchMock).toHaveBeenCalledTimes(1);
  });

  it("logs in again once within 5 minutes of exp", async () => {
    fetchMock
      .mockResolvedValueOnce(loginOk(jwt(24 * HOUR, "first")))
      .mockResolvedValueOnce(loginOk(jwt(48 * HOUR, "second")));

    const first = await getB2bToken();
    vi.setSystemTime(NOW.getTime() + 24 * HOUR - B2B_TOKEN_REFRESH_MARGIN_MS + 1000);
    const second = await getB2bToken();

    expect(fetchMock).toHaveBeenCalledTimes(2);
    expect(second).not.toBe(first);
  });

  it("follows the token's own exp, not a fixed TTL (a 1h token refreshes after ~55min)", async () => {
    fetchMock.mockImplementation(async () => loginOk(jwt(1 * HOUR)));

    await getB2bToken();
    vi.setSystemTime(NOW.getTime() + 54 * MIN);
    await getB2bToken();
    expect(fetchMock).toHaveBeenCalledTimes(1);

    vi.setSystemTime(NOW.getTime() + 56 * MIN);
    await getB2bToken();
    expect(fetchMock).toHaveBeenCalledTimes(2);
  });

  it("a token already inside its refresh margin is used once but not cached", async () => {
    fetchMock.mockImplementation(async () => loginOk(jwt(2 * MIN)));
    await getB2bToken();
    await getB2bToken();
    expect(fetchMock).toHaveBeenCalledTimes(2);
  });

  it("concurrent callers share one login", async () => {
    const token = jwt(24 * HOUR);
    fetchMock.mockImplementation(async () => loginOk(token));
    const tokens = await Promise.all([getB2bToken(), getB2bToken(), getB2bToken()]);
    expect(tokens).toEqual([token, token, token]);
    expect(fetchMock).toHaveBeenCalledTimes(1);
  });
});

describe("unknown login response shape", () => {
  it("errors (key NAMES only, never values) when data.jwt is absent", async () => {
    fetchMock.mockResolvedValue(res(200, { jwt: "secret-value-123", data: { other: "also-secret" } }));

    const err = await getB2bToken().catch((e) => e);

    expect(err).toBeInstanceOf(DelhiveryNotSpecifiedError);
    expect(err.message).toContain("data.jwt");
    expect(err.message).toContain("jwt, data");
    expect(err.message).toContain("data keys: other");
    expect(err.message).not.toContain("secret-value-123");
    expect(err.message).not.toContain("also-secret");
  });

  it("errors when data.jwt is not a non-empty string", async () => {
    fetchMock.mockResolvedValue(res(200, { data: { jwt: 12345 } }));
    await expect(getB2bToken()).rejects.toBeInstanceOf(DelhiveryNotSpecifiedError);
    fetchMock.mockResolvedValue(res(200, { data: { jwt: "" } }));
    await expect(getB2bToken()).rejects.toBeInstanceOf(DelhiveryNotSpecifiedError);
  });

  it("errors when data.jwt is not a JWT with a numeric exp (expiry unknown)", async () => {
    fetchMock.mockResolvedValue(loginOk("not-a-jwt"));
    await expect(getB2bToken()).rejects.toThrow(/exp/);
    fetchMock.mockResolvedValue(loginOk(`${b64({})}.${b64({ no: "exp" })}.sig`));
    await expect(getB2bToken()).rejects.toBeInstanceOf(DelhiveryNotSpecifiedError);
  });

  it("does not cache an unreadable login", async () => {
    const good = jwt(24 * HOUR);
    fetchMock.mockResolvedValueOnce(res(200, {})).mockResolvedValueOnce(loginOk(good));
    await expect(getB2bToken()).rejects.toBeInstanceOf(DelhiveryNotSpecifiedError);
    expect(await getB2bToken()).toBe(good);
  });
});

describe("wrong credentials: one attempt, then a 10 minute lock (no retry loop)", () => {
  it("makes exactly one request, then refuses to call the network for 10 minutes", async () => {
    fetchMock.mockImplementation(async () => res(401, { detail: "bad credentials" }));

    await expect(getB2bToken()).rejects.toBeInstanceOf(DelhiveryB2bAuthError);
    expect(fetchMock).toHaveBeenCalledTimes(1);

    vi.setSystemTime(NOW.getTime() + B2B_LOGIN_LOCK_MS - 1000);
    await expect(getB2bToken()).rejects.toBeInstanceOf(DelhiveryB2bAuthLockedError);
    await expect(getB2bToken()).rejects.toBeInstanceOf(DelhiveryB2bAuthLockedError);
    expect(fetchMock).toHaveBeenCalledTimes(1);
  });

  it("allows one new attempt after the lock expires", async () => {
    const good = jwt(24 * HOUR);
    fetchMock.mockResolvedValueOnce(res(401)).mockResolvedValueOnce(loginOk(good));

    await expect(getB2bToken()).rejects.toBeInstanceOf(DelhiveryB2bAuthError);
    vi.setSystemTime(NOW.getTime() + B2B_LOGIN_LOCK_MS + 1);

    expect(await getB2bToken()).toBe(good);
    expect(fetchMock).toHaveBeenCalledTimes(2);
  });

  it("a 5xx (their outage, not our credentials) does not lock", async () => {
    const good = jwt(24 * HOUR);
    fetchMock.mockResolvedValueOnce(res(503, "down")).mockResolvedValueOnce(loginOk(good));
    await expect(getB2bToken()).rejects.toBeInstanceOf(DelhiveryB2bAuthError);
    expect(await getB2bToken()).toBe(good);
  });

  it("a network failure does not lock either", async () => {
    const good = jwt(24 * HOUR);
    fetchMock.mockRejectedValueOnce(new Error("ECONNRESET")).mockResolvedValueOnce(loginOk(good));
    await expect(getB2bToken()).rejects.toThrow(/login request failed/);
    expect(await getB2bToken()).toBe(good);
  });
});

describe("the password is never exposed", () => {
  it("is absent from every error message and from all console output", async () => {
    const spies = (["log", "info", "warn", "error", "debug"] as const).map((m) => vi.spyOn(console, m).mockImplementation(() => {}));
    fetchMock.mockResolvedValueOnce(res(401, "nope"));

    const err = await getB2bToken().catch((e) => e);
    const locked = await getB2bToken().catch((e) => e);

    expect(String(err.message)).not.toContain("test-pass");
    expect(String(locked.message)).not.toContain("test-pass");
    for (const s of spies) for (const call of s.mock.calls) expect(JSON.stringify(call)).not.toContain("test-pass");
  });
});
