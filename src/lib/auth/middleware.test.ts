import { describe, it, expect, vi, beforeEach } from "vitest";
import { NextRequest } from "next/server";

// F-14 (Option 1): getAuthUser must reject a cryptographically-valid access
// token whose UserSession row has been revoked (disable / logout-all /
// password reset), and getCurrentUserId must NOT fall through to the NextAuth
// cookie when an mx_access/Bearer token is present.

interface FakeSession {
  id: string;
  isActive: boolean;
  expiresAt: Date;
}
let sessions: FakeSession[] = [];

vi.mock("@/lib/prisma", () => ({
  prisma: {
    userSession: {
      async findUnique({ where }: { where: { id: string } }) {
        return sessions.find((s) => s.id === where.id) ?? null;
      },
    },
  },
}));

const getServerSession = vi.fn();
vi.mock("next-auth", () => ({ getServerSession: (...a: unknown[]) => getServerSession(...a) }));
vi.mock("@/lib/auth", () => ({ authOptions: {} }));

// middleware.ts -> jwt.ts throws at import time without JWT_SECRET; vitest
// doesn't load .env. Set it before the dynamic imports (same pattern as
// credentials.test.ts / jwt.test.ts).
process.env.JWT_SECRET ??= "test-jwt-secret-middleware-suite";

const { signAccessToken } = await import("./jwt");
const { getAuthUser } = await import("./middleware");
const { getCurrentUserId } = await import("./current-user");

function reqWithBearer(token: string) {
  return new NextRequest("https://x.test/api/orders", { headers: { authorization: `Bearer ${token}` } });
}

beforeEach(() => {
  sessions = [];
  getServerSession.mockReset();
});

describe("getAuthUser — UserSession cross-check", () => {
  it("returns the payload when the session is active and unexpired", async () => {
    const token = await signAccessToken({ userId: "u1", email: "a@b.c", role: "DEALER", sessionId: "s1" });
    sessions.push({ id: "s1", isActive: true, expiresAt: new Date(Date.now() + 3_600_000) });
    const user = await getAuthUser(reqWithBearer(token));
    expect(user?.userId).toBe("u1");
  });

  it("returns null when the session has been revoked (isActive=false)", async () => {
    const token = await signAccessToken({ userId: "u1", email: "a@b.c", role: "DEALER", sessionId: "s1" });
    sessions.push({ id: "s1", isActive: false, expiresAt: new Date(Date.now() + 3_600_000) });
    expect(await getAuthUser(reqWithBearer(token))).toBeNull();
  });

  it("returns null when the session row is gone", async () => {
    const token = await signAccessToken({ userId: "u1", email: "a@b.c", role: "DEALER", sessionId: "missing" });
    expect(await getAuthUser(reqWithBearer(token))).toBeNull();
  });

  it("returns null when the session has expired", async () => {
    const token = await signAccessToken({ userId: "u1", email: "a@b.c", role: "DEALER", sessionId: "s1" });
    sessions.push({ id: "s1", isActive: true, expiresAt: new Date(Date.now() - 1000) });
    expect(await getAuthUser(reqWithBearer(token))).toBeNull();
  });
});

describe("getCurrentUserId — no fallthrough when a Bearer token is present", () => {
  it("does not consult the NextAuth session when a Bearer token is present but revoked", async () => {
    const token = await signAccessToken({ userId: "u1", email: "a@b.c", role: "DEALER", sessionId: "s1" });
    sessions.push({ id: "s1", isActive: false, expiresAt: new Date(Date.now() + 3_600_000) });
    getServerSession.mockResolvedValue({ user: { id: "u1" } }); // would authenticate if consulted

    expect(await getCurrentUserId(reqWithBearer(token))).toBeNull();
    expect(getServerSession).not.toHaveBeenCalled();
  });

  it("falls through to NextAuth only when no access token is present", async () => {
    getServerSession.mockResolvedValue({ user: { id: "web-user" } });
    const req = new NextRequest("https://x.test/api/orders");
    expect(await getCurrentUserId(req)).toBe("web-user");
    expect(getServerSession).toHaveBeenCalledTimes(1);
  });
});
