import { afterEach, describe, expect, it, vi } from "vitest";
import { verifyGstin } from "./verify-gstin";

const GSTIN = "27AAPFU0939F1ZV";

afterEach(() => {
  vi.unstubAllEnvs();
  vi.restoreAllMocks();
});

describe("verifyGstin", () => {
  it("is PENDING (never verified) without the internal token", async () => {
    vi.stubEnv("INTERNAL_API_TOKEN", "");
    vi.spyOn(console, "warn").mockImplementation(() => {});
    const f = vi.fn();
    expect((await verifyGstin(GSTIN, f)).status).toBe("PENDING");
    expect(f).not.toHaveBeenCalled();
  });

  it("passes through the Java service's answer, sending the token", async () => {
    vi.stubEnv("INTERNAL_API_TOKEN", "t".repeat(40));
    vi.stubEnv("JAVA_API_URL", "http://java.local/");
    const f = vi.fn(async () =>
      new Response(JSON.stringify({ status: "VERIFIED", legalName: "ACME", registrationStatus: "Active" }), { status: 200 })
    );
    const r = await verifyGstin(GSTIN, f as unknown as typeof fetch);
    expect(r).toMatchObject({ status: "VERIFIED", legalName: "ACME", registrationStatus: "Active", tradeName: null });
    const [url, init] = f.mock.calls[0] as unknown as [string, RequestInit];
    expect(url).toBe("http://java.local/api/internal/gstin/verify");
    expect((init.headers as Record<string, string>)["X-Internal-Token"]).toBe("t".repeat(40));
  });

  it("is PENDING on HTTP errors, network errors and unknown statuses", async () => {
    vi.stubEnv("INTERNAL_API_TOKEN", "t".repeat(40));
    vi.spyOn(console, "warn").mockImplementation(() => {});
    const http500 = vi.fn(async () => new Response("{}", { status: 500 }));
    const boom = vi.fn(async () => { throw new TypeError("fetch failed"); });
    const weird = vi.fn(async () => new Response(JSON.stringify({ status: "TOTALLY_FINE" }), { status: 200 }));
    for (const f of [http500, boom, weird]) {
      expect((await verifyGstin(GSTIN, f as unknown as typeof fetch)).status).toBe("PENDING");
    }
  });
});
