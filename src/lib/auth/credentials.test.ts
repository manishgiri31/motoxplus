import { describe, it, expect, vi, beforeEach } from "vitest";
import bcrypt from "bcryptjs";

// Real password hash so bcrypt.compare exercises the real comparison instead
// of being mocked away — the thing under test is authenticateWithPassword's
// control flow (lockout, rate limiting, audit logging), not bcrypt itself.
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
  lastLoginIP?: string;
  lastDevice?: string;
  dealer: null;
  vendor: null;
  admin: null;
}

let users: FakeUser[] = [];
let loginHistory: Array<{ userId: string; success: boolean; method?: string; reason?: string }> = [];

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
    loginHistory: {
      async create({ data }: any) {
        loginHistory.push(data);
        return data;
      },
    },
  },
}));

// Only checkRateLimit is stubbed — recordFailedLogin/clearFailedLogins/
// isAccountLocked (also from this module) stay real, since lockout behavior
// is what several of these tests actually exercise. Without REDIS_URL set,
// the real checkRateLimit fails closed for the LOGIN budget (by design —
// see rate-limit-budgets.ts), which would block every attempt in this suite
// before it ever reached the credential check.
vi.mock("./rate-limit", async (importOriginal) => {
  const actual = await importOriginal<typeof import("./rate-limit")>();
  return { ...actual, checkRateLimit: vi.fn(async () => ({ allowed: true, retryAfterSeconds: 0 })) };
});

// credentials.ts pulls in rate-limit-budgets.ts -> middleware.ts -> jwt.ts,
// which throws at import time if JWT_SECRET isn't set (see jwt.test.ts) —
// vitest doesn't load .env the way the Next.js app itself does, so this
// needs to be set explicitly before the dynamic import below runs.
process.env.JWT_SECRET ??= "test-jwt-secret-credentials-suite";

const { authenticateWithPassword } = await import("./credentials");

let counter = 0;
function uniqueEmail() {
  // Rate limiting in credentials.ts is keyed by identifier; a fresh email
  // per test keeps tests independent instead of tripping each other's LOGIN
  // budget via the shared in-memory limiter.
  return `dealer${counter++}@example.com`;
}

beforeEach(() => {
  users = [];
  loginHistory = [];
});

describe("authenticateWithPassword", () => {
  it("succeeds with valid credentials", async () => {
    const email = uniqueEmail();
    users.push(makeUser({ email }));

    const result = await authenticateWithPassword({ identifierRaw: email, password: PASSWORD, ipAddress: "1.2.3.4" });

    expect(result.ok).toBe(true);
    if (result.ok) {
      expect(result.user.email).toBe(email);
      expect(result.method).toBe("password-email");
    }
    expect(loginHistory.at(-1)).toMatchObject({ success: true });
  });

  it("rejects an invalid password without revealing which field was wrong", async () => {
    const email = uniqueEmail();
    users.push(makeUser({ email }));

    const result = await authenticateWithPassword({ identifierRaw: email, password: "wrong-password" });

    expect(result).toMatchObject({ ok: false, code: "INVALID_CREDENTIALS" });
    expect(loginHistory.at(-1)).toMatchObject({ success: false, reason: "Incorrect password" });
  });

  it("rejects an unknown identifier with the same generic error as a wrong password", async () => {
    const result = await authenticateWithPassword({ identifierRaw: uniqueEmail(), password: PASSWORD });
    expect(result).toMatchObject({ ok: false, code: "INVALID_CREDENTIALS", message: "Invalid email/mobile or password" });
  });

  it("rejects a disabled account", async () => {
    const email = uniqueEmail();
    users.push(makeUser({ email, isActive: false }));

    const result = await authenticateWithPassword({ identifierRaw: email, password: PASSWORD });
    expect(result).toMatchObject({ ok: false, code: "ACCOUNT_DISABLED" });
  });

  it("rejects a locked account even with the correct password", async () => {
    const email = uniqueEmail();
    users.push(makeUser({ email, accountLockedUntil: new Date(Date.now() + 10 * 60 * 1000) }));

    const result = await authenticateWithPassword({ identifierRaw: email, password: PASSWORD });
    expect(result).toMatchObject({ ok: false, code: "ACCOUNT_LOCKED" });
  });

  it("locks the account after 5 failed attempts", async () => {
    const email = uniqueEmail();
    users.push(makeUser({ email }));

    let last;
    for (let i = 0; i < 5; i++) {
      last = await authenticateWithPassword({ identifierRaw: email, password: "wrong" });
    }

    expect(last).toMatchObject({ ok: false, code: "ACCOUNT_LOCKED" });
    const user = users.find((u) => u.email === email)!;
    expect(user.accountLockedUntil).not.toBeNull();

    // A correct password no longer helps once locked.
    const afterLock = await authenticateWithPassword({ identifierRaw: email, password: PASSWORD });
    expect(afterLock).toMatchObject({ ok: false, code: "ACCOUNT_LOCKED" });
  });

  it("clears failed-attempt count on a successful login", async () => {
    const email = uniqueEmail();
    users.push(makeUser({ email, failedLoginAttempts: 3 }));

    const result = await authenticateWithPassword({ identifierRaw: email, password: PASSWORD });

    expect(result.ok).toBe(true);
    const user = users.find((u) => u.email === email)!;
    expect(user.failedLoginAttempts).toBe(0);
  });

  it("resolves a bare Indian mobile number as the mobile identifier kind", async () => {
    users.push(makeUser({ email: uniqueEmail(), mobileNumber: "9876543210" }));

    const result = await authenticateWithPassword({ identifierRaw: "9876543210", password: PASSWORD });

    expect(result.ok).toBe(true);
    if (result.ok) expect(result.method).toBe("password-mobile");
  });
});
