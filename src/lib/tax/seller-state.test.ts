import { describe, it, expect, vi, beforeEach, afterEach } from "vitest";

const prismaMock = { setting: { findUnique: vi.fn() } };
vi.mock("@/lib/prisma", () => ({ prisma: prismaMock }));

describe("getSellerState", () => {
  const originalEnv = process.env.SELLER_STATE;

  beforeEach(() => {
    vi.clearAllMocks();
    vi.resetModules();
    delete process.env.SELLER_STATE;
  });

  afterEach(() => {
    if (originalEnv === undefined) delete process.env.SELLER_STATE;
    else process.env.SELLER_STATE = originalEnv;
  });

  it("reads the Setting row when present", async () => {
    prismaMock.setting.findUnique.mockResolvedValue({ value: "Maharashtra" });
    const { getSellerState } = await import("./seller-state");
    expect(await getSellerState()).toBe("Maharashtra");
  });

  it("falls back to SELLER_STATE env when the Setting row is missing", async () => {
    prismaMock.setting.findUnique.mockResolvedValue(null);
    process.env.SELLER_STATE = "Karnataka";
    const { getSellerState } = await import("./seller-state");
    expect(await getSellerState()).toBe("Karnataka");
  });

  it("falls back to the hardcoded default when neither the Setting row nor the env var exist", async () => {
    prismaMock.setting.findUnique.mockResolvedValue(null);
    const { getSellerState } = await import("./seller-state");
    expect(await getSellerState()).toBe("Delhi");
  });

  it("caches the value — a second call within the TTL doesn't hit the DB again", async () => {
    prismaMock.setting.findUnique.mockResolvedValue({ value: "Gujarat" });
    const { getSellerState } = await import("./seller-state");
    await getSellerState();
    await getSellerState();
    expect(prismaMock.setting.findUnique).toHaveBeenCalledTimes(1);
  });
});
