import { describe, it, expect, vi, beforeEach } from "vitest";
import bcrypt from "bcryptjs";

/**
 * Exercises authenticateWithPassword() against the REAL rate-limit module
 * (in-memory backend — no REDIS_URL in the test env, see rate-limit.ts) to
 * prove the specific traps a two-step, budget-gated login flow is prone to:
 * one account's lockout leaking into another's, one IP's abuse leaking into
 * a different IP's traffic, and a successful login not actually clearing the
 * counter it's supposed to. credentials.test.ts covers the DB-lock logic in
 * isolation with checkRateLimit mocked out; this file is the complement —
 * rate-limit.ts is real here, only prisma is faked.
 */
const PASSWORD = "correct-horse-battery-staple";
const PASSWORD_HASH = bcrypt.hashSync(PASSWORD, 4);

interface FakeUser {
  id: string;
  email: string;
  mobileNumber: string | null;
  password: string | null;
  name: string | null;
  role: string;
  isActive: boolean;
  accountLockedUntil: Date | null;
  failedLoginAttempts: number;
  emailVerified: Date | null;
  mobileVerified: boolean;
  dealer: null;
  vendor: null;
  admin: null;
}

let users: FakeUser[] = [];

function makeUser(overrides: Partial<FakeUser>): FakeUser {
  return {
    id: `user_${users.length + 1}`,
    email: "dealer@example.com",
    mobileNumber: null,
    password: PASSWORD_HASH,
    name: "Test Dealer",
    role: "DEALER",
    isActive: true,
    accountLockedUntil: null,
    failedLoginAttempts: 0,
    emailVerified: new Date(),
    mobileVerified: true,
    dealer: null,
    vendor: null,
    admin: null,
    ...overrides,
  };
}

vi.mock("@/lib/prisma", () => ({
  prisma: {
    user: {
      async findUnique({ where, select }: any) {
        const user = users.find((u) => (where.id ? u.id === where.id : where.email ? u.email === where.email : u.mobileNumber === where.mobileNumber));
        if (!user) return null;
        if (select) {
          const projected: Record<string, unknown> = {};
          for (const key of Object.keys(select)) projected[key] = (user as any)[key];
          return projected;
        }
        return user;
      },
      async update({ where, data, select }: any) {
        const user = users.find((u) => u.id === where.id);
        if (!user) throw new Error("not found");
        for (const [key, value] of Object.entries(data)) {
          if (value && typeof value === "object" && "increment" in (value as any)) {
            (user as any)[key] = ((user as any)[key] ?? 0) + (value as any).increment;
          } else {
            (user as any)[key] = value;
          }
        }
        if (select) {
          const projected: Record<string, unknown> = {};
          for (const key of Object.keys(select)) projected[key] = (user as any)[key];
          return projected;
        }
        return user;
      },
    },
    loginHistory: { async create() { return null; } },
  },
}));

process.env.JWT_SECRET ??= "test-jwt-secret-login-rate-limit-suite";

const { authenticateWithPassword } = await import("./credentials");

let counter = 0;
function uniqueEmail() {
  return `ratelimit${counter++}@example.com`;
}

beforeEach(() => {
  users = [];
});

describe("authenticateWithPassword — real rate-limit module (in-memory backend)", () => {
  it("locking one identifier out doesn't touch a different identifier's bucket", async () => {
    const emailA = uniqueEmail();
    const emailB = uniqueEmail();
    users.push(makeUser({ email: emailA }));
    users.push(makeUser({ email: emailB }));

    for (let i = 0; i < 5; i++) {
      await authenticateWithPassword({ identifierRaw: emailA, password: "wrong", ipAddress: "10.0.0.1" });
    }
    const lockedOut = await authenticateWithPassword({ identifierRaw: emailA, password: "wrong", ipAddress: "10.0.0.1" });
    expect(lockedOut.ok).toBe(false);

    // A different account, from the same IP, on its very first attempt —
    // must not inherit A's exhausted bucket.
    const resultB = await authenticateWithPassword({ identifierRaw: emailB, password: PASSWORD, ipAddress: "10.0.0.1" });
    expect(resultB).toMatchObject({ ok: true });
  });

  it("failures against many identifiers from one IP eventually trip the per-IP budget, but a different IP is unaffected", async () => {
    const sharedIp = "10.0.0.99";
    // RATE_LIMITS.LOGIN.perIP is 20/15min — 20 distinct never-registered
    // identifiers, one failed attempt each, all from the same IP.
    for (let i = 0; i < 20; i++) {
      const result = await authenticateWithPassword({ identifierRaw: uniqueEmail(), password: "wrong", ipAddress: sharedIp });
      expect(result.ok).toBe(false);
    }

    // The 21st distinct identifier from that same IP should now be blocked
    // by the IP layer even though this exact identifier has never been seen.
    const blocked = await authenticateWithPassword({ identifierRaw: uniqueEmail(), password: "wrong", ipAddress: sharedIp });
    expect(blocked).toMatchObject({ ok: false, code: "RATE_LIMITED" });

    // A brand-new identifier from a DIFFERENT IP must not be caught by the
    // first IP's exhausted bucket.
    const emailOther = uniqueEmail();
    users.push(makeUser({ email: emailOther }));
    const otherIpResult = await authenticateWithPassword({ identifierRaw: emailOther, password: PASSWORD, ipAddress: "10.0.0.100" });
    expect(otherIpResult).toMatchObject({ ok: true });
  });

  it("a successful login resets the per-identifier counter instead of letting failures accumulate across it", async () => {
    const email = uniqueEmail();
    users.push(makeUser({ email }));

    // 3 failures — below both the rate-limit (5) and lockout (5) thresholds.
    for (let i = 0; i < 3; i++) {
      await authenticateWithPassword({ identifierRaw: email, password: "wrong" });
    }

    const success = await authenticateWithPassword({ identifierRaw: email, password: PASSWORD });
    expect(success.ok).toBe(true);

    // If the counter weren't cleared on success, these 4 would land on top
    // of the earlier 3 and cross the 5-failure threshold immediately.
    let last;
    for (let i = 0; i < 4; i++) {
      last = await authenticateWithPassword({ identifierRaw: email, password: "wrong" });
    }
    expect(last).toMatchObject({ ok: false, code: "INVALID_CREDENTIALS" });

    // Confirms the account isn't already locked/rate-limited — a correct
    // password on the very next attempt still gets through.
    const stillWorks = await authenticateWithPassword({ identifierRaw: email, password: PASSWORD });
    expect(stillWorks.ok).toBe(true);
  });

  it("allows the (threshold - 1)th failed attempt through as a normal wrong-password result, not a lockout", async () => {
    const email = uniqueEmail();
    users.push(makeUser({ email }));

    let last;
    for (let i = 0; i < 4; i++) {
      last = await authenticateWithPassword({ identifierRaw: email, password: "wrong" });
    }
    expect(last).toMatchObject({ ok: false, code: "INVALID_CREDENTIALS" });

    // The account isn't locked yet — the correct password on the 5th
    // attempt must still succeed.
    const result = await authenticateWithPassword({ identifierRaw: email, password: PASSWORD });
    expect(result.ok).toBe(true);
  });

  it("a request with no resolvable client IP doesn't collapse into a shared bucket with other unresolvable-IP requests", async () => {
    // ipAddress undefined (no X-Forwarded-For/X-Real-IP) must skip the
    // per-IP layer entirely rather than keying on a shared sentinel — see
    // UNKNOWN_IP's doc comment in middleware.ts.
    const emailA = uniqueEmail();
    const emailB = uniqueEmail();
    users.push(makeUser({ email: emailA }));
    users.push(makeUser({ email: emailB }));

    for (let i = 0; i < 5; i++) {
      await authenticateWithPassword({ identifierRaw: emailA, password: "wrong" });
    }
    const resultB = await authenticateWithPassword({ identifierRaw: emailB, password: PASSWORD });
    expect(resultB).toMatchObject({ ok: true });
  });
});
