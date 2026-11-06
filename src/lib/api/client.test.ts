import { describe, expect, it, vi } from "vitest";
import { ApiError, NetworkError, apiFetch } from "./client";

const json = (status: number, body: unknown, headers: Record<string, string> = {}) =>
  new Response(body === undefined ? null : JSON.stringify(body), { status, headers });

describe("apiFetch", () => {
  it("calls the relative /api/v1 base with cookies and parses JSON", async () => {
    const f = vi.fn().mockResolvedValue(json(200, { ok: 1 }));
    const out = await apiFetch<{ ok: number }>("/me/permissions", {}, f);
    expect(out).toEqual({ ok: 1 });
    const [url, init] = f.mock.calls[0];
    expect(url).toBe("/api/v1/me/permissions");
    expect(init.credentials).toBe("include");
  });

  it("serialises json bodies and leaves FormData untouched", async () => {
    const f = vi.fn().mockImplementation(async () => json(200, {}));
    await apiFetch("/x", { method: "POST", json: { a: 1 } }, f);
    expect(f.mock.calls[0][1].body).toBe('{"a":1}');
    expect((f.mock.calls[0][1].headers as Headers).get("Content-Type")).toBe("application/json");

    const fd = new FormData();
    fd.append("k", "v");
    await apiFetch("/x", { method: "POST", body: fd }, f);
    expect(f.mock.calls[1][1].body).toBe(fd);
    expect((f.mock.calls[1][1].headers as Headers).get("Content-Type")).toBeNull();
  });

  it("returns undefined for 204", async () => {
    const f = vi.fn().mockResolvedValue(new Response(null, { status: 204 }));
    expect(await apiFetch("/x", { method: "DELETE" }, f)).toBeUndefined();
  });

  it("maps error bodies, field errors and Retry-After into ApiError", async () => {
    const f = vi.fn().mockResolvedValue(
      json(400, { error: "Validation failed", code: "VALIDATION_FAILED", fieldErrors: { email: "bad" } })
    );
    await expect(apiFetch("/x", {}, f)).rejects.toMatchObject({
      name: "ApiError", status: 400, code: "VALIDATION_FAILED", message: "Validation failed", fieldErrors: { email: "bad" },
    });

    const g = vi.fn().mockResolvedValue(json(429, { error: "slow down" }, { "Retry-After": "30" }));
    await expect(apiFetch("/x", {}, g)).rejects.toMatchObject({ status: 429, retryAfterSeconds: 30 });
  });

  it("copes with non-JSON error pages (proxy 502)", async () => {
    const f = vi.fn().mockResolvedValue(new Response("<html>Bad gateway</html>", { status: 502 }));
    await expect(apiFetch("/x", {}, f)).rejects.toMatchObject({ status: 502, message: "Request failed (502)" });
  });

  it("turns a failed fetch into NetworkError but lets aborts through", async () => {
    await expect(apiFetch("/x", {}, vi.fn().mockRejectedValue(new TypeError("fetch failed")))).rejects.toBeInstanceOf(NetworkError);
    const abort = new DOMException("aborted", "AbortError");
    await expect(apiFetch("/x", {}, vi.fn().mockRejectedValue(abort))).rejects.toBe(abort);
  });

  it("on 401 refreshes the session once and retries once", async () => {
    const f = vi
      .fn()
      .mockResolvedValueOnce(json(401, { error: "Unauthorized" }))
      .mockResolvedValueOnce(json(200, {})) // /api/auth/refresh
      .mockResolvedValueOnce(json(200, { ok: true }));
    expect(await apiFetch("/vendors/me", {}, f)).toEqual({ ok: true });
    expect(f.mock.calls.map((c) => c[0])).toEqual(["/api/v1/vendors/me", "/api/auth/refresh", "/api/v1/vendors/me"]);
    expect(f.mock.calls[1][1].method).toBe("POST");
  });

  it("does not loop when the refresh fails: surfaces the 401", async () => {
    const f = vi
      .fn()
      .mockResolvedValueOnce(json(401, { error: "Unauthorized" }))
      .mockResolvedValueOnce(json(401, { error: "no session" })); // refresh rejected
    await expect(apiFetch("/vendors/me", {}, f)).rejects.toMatchObject({ status: 401 });
    expect(f).toHaveBeenCalledTimes(2);
  });

  it("surfaces a second 401 after a successful refresh instead of looping", async () => {
    const f = vi
      .fn()
      .mockResolvedValueOnce(json(401, { error: "Unauthorized" }))
      .mockResolvedValueOnce(json(200, {}))
      .mockResolvedValueOnce(json(401, { error: "Unauthorized" }));
    await expect(apiFetch("/vendors/me", {}, f)).rejects.toBeInstanceOf(ApiError);
    expect(f).toHaveBeenCalledTimes(3);
  });

  it("never refreshes for public calls (auth:false)", async () => {
    const f = vi.fn().mockResolvedValue(json(401, { error: "nope" }));
    await expect(apiFetch("/vendors/register", { auth: false }, f)).rejects.toMatchObject({ status: 401 });
    expect(f).toHaveBeenCalledTimes(1);
  });

  it("shares one refresh between concurrent 401s", async () => {
    let refreshCalls = 0;
    const f = vi.fn(async (url: RequestInfo | URL) => {
      if (String(url) === "/api/auth/refresh") {
        refreshCalls++;
        await new Promise((r) => setTimeout(r, 10));
        return json(200, {});
      }
      // first hit of each path is 401, the retry succeeds
      const seen = (f.mock.calls as unknown[][]).filter((c) => c[0] === url).length;
      return seen <= 1 ? json(401, {}) : json(200, { ok: true });
    });
    const [a, b] = await Promise.all([apiFetch("/a", {}, f as unknown as typeof fetch), apiFetch("/b", {}, f as unknown as typeof fetch)]);
    expect(a).toEqual({ ok: true });
    expect(b).toEqual({ ok: true });
    expect(refreshCalls).toBe(1);
  });

  it("reports an unreadable 2xx body", async () => {
    const f = vi.fn().mockResolvedValue(new Response("not json", { status: 200 }));
    await expect(apiFetch("/x", {}, f)).rejects.toMatchObject({ code: "BAD_RESPONSE" });
  });
});
