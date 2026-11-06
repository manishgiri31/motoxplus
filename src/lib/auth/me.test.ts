import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

const cookieHeader = { value: "next-auth.session-token=abc; mx_access=xyz" as string | null };
vi.mock("next/headers", () => ({ headers: async () => ({ get: (k: string) => (k === "cookie" ? cookieHeader.value : null) }) }));

const { getMe, internalApiBaseUrl } = await import("./me");

describe("internalApiBaseUrl", () => {
  it("defaults to this process on PORT (or 3000)", () => {
    expect(internalApiBaseUrl({})).toBe("http://127.0.0.1:3000");
    expect(internalApiBaseUrl({ PORT: "3001" })).toBe("http://127.0.0.1:3001");
  });

  it("can point at another backend and strips a trailing slash", () => {
    expect(internalApiBaseUrl({ INTERNAL_API_URL: "http://127.0.0.1:8080/" })).toBe("http://127.0.0.1:8080");
  });
});

describe("getMe", () => {
  const fetchMock = vi.fn();
  beforeEach(() => {
    fetchMock.mockReset();
    vi.stubGlobal("fetch", fetchMock);
    cookieHeader.value = "next-auth.session-token=abc; mx_access=xyz";
  });
  afterEach(() => vi.unstubAllGlobals());

  it("forwards the visitor's cookies and returns the user", async () => {
    fetchMock.mockResolvedValue(new Response(JSON.stringify({ user: { id: "u1", role: "ADMIN" } }), { status: 200 }));
    const me = await getMe();
    expect(me).toEqual({ id: "u1", role: "ADMIN" });
    const [url, init] = fetchMock.mock.calls[0];
    expect(url).toMatch(/\/api\/auth\/me$/);
    expect(init.headers.cookie).toBe("next-auth.session-token=abc; mx_access=xyz");
    expect(init.cache).toBe("no-store");
  });

  it("returns null when signed out (401) or the user is gone (404)", async () => {
    fetchMock.mockResolvedValueOnce(new Response("{}", { status: 401 }));
    expect(await getMe()).toBeNull();
    fetchMock.mockResolvedValueOnce(new Response("{}", { status: 404 }));
    expect(await getMe()).toBeNull();
  });

  it("sends an empty cookie header for an anonymous visitor", async () => {
    cookieHeader.value = null;
    fetchMock.mockResolvedValue(new Response("{}", { status: 401 }));
    await getMe();
    expect(fetchMock.mock.calls[0][1].headers.cookie).toBe("");
  });

  it("throws on server errors instead of pretending the user is signed out", async () => {
    fetchMock.mockResolvedValue(new Response("boom", { status: 500 }));
    await expect(getMe()).rejects.toThrow(/HTTP 500/);
  });
});
