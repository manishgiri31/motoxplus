import { beforeEach, describe, expect, it, vi } from "vitest";
import { NextRequest } from "next/server";

const getServerSession = vi.fn();
const requireAuth = vi.fn();
const findUnique = vi.fn();

vi.mock("next-auth", () => ({ getServerSession: (...a: unknown[]) => getServerSession(...a) }));
vi.mock("@/lib/auth", () => ({ authOptions: {} }));
vi.mock("@/lib/auth/middleware", () => ({ requireAuth: (...a: unknown[]) => requireAuth(...a) }));
vi.mock("@/lib/prisma", () => ({ prisma: { user: { findUnique: (...a: unknown[]) => findUnique(...a) } } }));

const { GET } = await import("./route");

const req = () => new NextRequest("http://localhost/api/auth/me");
const dbUser = (over: Record<string, unknown> = {}) => ({
  id: "u1", name: "Asha", email: "asha@example.com", role: "DEALER", department: null, image: null,
  emailVerified: null, mobileNumber: "9876543210", mobileVerified: true, twoFactorEnabled: false,
  lastLogin: null, createdAt: new Date("2026-01-01T00:00:00Z"), isActive: true,
  dealer: { id: "d1", companyName: "Acme", status: "ACTIVE", gstNumber: null },
  admin: null, vendor: null, customer: null, ...over,
});

describe("GET /api/auth/me", () => {
  beforeEach(() => {
    getServerSession.mockReset();
    requireAuth.mockReset();
    findUnique.mockReset();
  });

  it("returns 401 with no NextAuth session and no token", async () => {
    getServerSession.mockResolvedValue(null);
    requireAuth.mockResolvedValue(null);
    const res = await GET(req());
    expect(res.status).toBe(401);
    expect(await res.json()).toEqual({ error: "Unauthorized" });
    expect(findUnique).not.toHaveBeenCalled();
  });

  it("returns the user from the NextAuth session, read fresh from the DB", async () => {
    getServerSession.mockResolvedValue({ user: { id: "u1", role: "DEALER" } });
    findUnique.mockResolvedValue(dbUser());

    const res = await GET(req());
    expect(res.status).toBe(200);
    const body = await res.json();
    expect(body.user).toMatchObject({ id: "u1", role: "DEALER", dealer: { id: "d1", status: "ACTIVE" } });
    expect(findUnique.mock.calls[0][0].where).toEqual({ id: "u1" });
    expect(requireAuth).not.toHaveBeenCalled(); // NextAuth wins when present
  });

  it("never leaks the internal isActive flag or a password", async () => {
    getServerSession.mockResolvedValue({ user: { id: "u1" } });
    findUnique.mockResolvedValue(dbUser());
    const body = await (await GET(req())).json();
    expect(body.user).not.toHaveProperty("isActive");
    expect(body.user).not.toHaveProperty("password");
    expect(findUnique.mock.calls[0][0].select.password).toBeUndefined();
  });

  it("still accepts the mx_access / Bearer token when there is no NextAuth session (unchanged behaviour)", async () => {
    getServerSession.mockResolvedValue(null);
    requireAuth.mockResolvedValue({ userId: "u2", email: "x@y.com", role: "VENDOR", sessionId: "s2" });
    findUnique.mockResolvedValue(dbUser({ id: "u2", role: "VENDOR", dealer: null, vendor: { id: "v2", status: "APPROVED" } }));

    const res = await GET(req());
    expect(res.status).toBe(200);
    expect((await res.json()).user).toMatchObject({ id: "u2", vendor: { id: "v2" } });
  });

  it("rejects a disabled account even if its NextAuth JWT is still valid", async () => {
    getServerSession.mockResolvedValue({ user: { id: "u1" } });
    findUnique.mockResolvedValue(dbUser({ isActive: false }));
    expect((await GET(req())).status).toBe(401);
  });

  it("returns 404 when the user row no longer exists", async () => {
    getServerSession.mockResolvedValue({ user: { id: "gone" } });
    findUnique.mockResolvedValue(null);
    expect((await GET(req())).status).toBe(404);
  });

  it("is never cached", async () => {
    getServerSession.mockResolvedValue(null);
    requireAuth.mockResolvedValue(null);
    expect((await GET(req())).headers.get("cache-control")).toBe("no-store");
  });
});
