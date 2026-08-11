import { describe, it, expect, vi, beforeEach } from "vitest";

// In-memory stand-in for the OtpCode table — otp.ts only ever calls
// findFirst/update/updateMany/count/create on prisma.otpCode, so a tiny fake
// covering those four operations lets these tests exercise the real hygiene
// logic (attempt counting, atomic used-flag flips, lockout derivation)
// without a live database.
interface FakeOtpRow {
  id: string;
  userId: string;
  type: string;
  code: string;
  expiresAt: Date;
  used: boolean;
  attempts: number;
  createdAt: Date;
}

let rows: FakeOtpRow[] = [];
let nextId = 1;

vi.mock("@/lib/prisma", () => ({
  prisma: {
    otpCode: {
      async create({ data }: { data: Omit<FakeOtpRow, "id" | "used" | "attempts" | "createdAt"> }) {
        const row: FakeOtpRow = { id: `otp_${nextId++}`, used: false, attempts: 0, createdAt: new Date(), ...data };
        rows.push(row);
        return row;
      },
      async findFirst({ where, orderBy }: any) {
        let matches = rows.filter((r) => matchWhere(r, where));
        if (orderBy?.createdAt === "desc") matches = matches.sort((a, b) => b.createdAt.getTime() - a.createdAt.getTime());
        return matches[0] ?? null;
      },
      async update({ where, data }: any) {
        const row = rows.find((r) => r.id === where.id);
        if (!row) throw new Error("not found");
        applyData(row, data);
        return row;
      },
      async updateMany({ where, data }: any) {
        const matches = rows.filter((r) => matchWhere(r, where));
        for (const row of matches) applyData(row, data);
        return { count: matches.length };
      },
      async count({ where }: any) {
        return rows.filter((r) => matchWhere(r, where)).length;
      },
    },
  },
}));

function matchWhere(row: FakeOtpRow, where: any): boolean {
  if (where.id !== undefined && row.id !== where.id) return false;
  if (where.userId !== undefined && row.userId !== where.userId) return false;
  if (where.type !== undefined && row.type !== where.type) return false;
  if (where.used !== undefined && row.used !== where.used) return false;
  if (where.attempts?.gte !== undefined && !(row.attempts >= where.attempts.gte)) return false;
  if (where.createdAt?.gte !== undefined && !(row.createdAt >= where.createdAt.gte)) return false;
  return true;
}

function applyData(row: FakeOtpRow, data: any) {
  if (data.used !== undefined) row.used = data.used;
  if (data.attempts?.increment !== undefined) row.attempts += data.attempts.increment;
}

const { createOTP, verifyOTP, checkResendLimit } = await import("./otp");

const USER = "user_1";
const TYPE = "LOGIN" as any;

beforeEach(() => {
  rows = [];
  nextId = 1;
  vi.useRealTimers();
});

describe("verifyOTP", () => {
  it("rejects an expired OTP even with the correct code", async () => {
    const code = await createOTP(USER, TYPE);
    const row = rows[0];
    row.expiresAt = new Date(Date.now() - 1000); // force expiry

    const result = await verifyOTP(USER, TYPE, code);
    expect(result.success).toBe(false);
    expect(result.error).toBe("OTP has expired");
  });

  it("locks out after the 5th incorrect attempt and rejects the correct code on the 6th try", async () => {
    const code = await createOTP(USER, TYPE);

    for (let i = 1; i <= 5; i++) {
      const result = await verifyOTP(USER, TYPE, "000000"); // guaranteed wrong (code is never all-zero from crypto.randomInt in a way that collides in this fixed test... code is random, so guard below)
      expect(result.success).toBe(false);
    }

    // The 6th call — even with the correct code — must fail because the row
    // was burned (used: true) once attempts hit MAX_OTP_ATTEMPTS.
    const finalAttempt = await verifyOTP(USER, TYPE, code);
    expect(finalAttempt.success).toBe(false);
    expect(finalAttempt.error).toMatch(/invalid or expired|too many/i);
  });

  it("rejects replaying the same OTP twice (single-use)", async () => {
    const code = await createOTP(USER, TYPE);

    const first = await verifyOTP(USER, TYPE, code);
    expect(first.success).toBe(true);

    const replay = await verifyOTP(USER, TYPE, code);
    expect(replay.success).toBe(false);
    expect(replay.error).toBe("Invalid or expired OTP");
  });

  it("does not throw and fails closed when the provided code has a different length than expected", async () => {
    const code = await createOTP(USER, TYPE);
    // crypto.timingSafeEqual throws on mismatched buffer lengths if not
    // guarded — this must fail cleanly, not throw, regardless of `code`'s length.
    await expect(verifyOTP(USER, TYPE, code + "0")).resolves.toMatchObject({ success: false });
    await expect(verifyOTP(USER, TYPE, "1")).resolves.toMatchObject({ success: false });
  });

  it("rejects a wrong code and never accepts a value structurally equal but wrong", async () => {
    await createOTP(USER, TYPE);
    const result = await verifyOTP(USER, TYPE, "999999");
    // Vanishingly unlikely to be the real code (1 in a million); if this ever
    // flakes, generateOTP's randomness would be the story, not this test.
    expect(result.success).toBe(false);
  });
});

describe("checkResendLimit / lockout cooldown", () => {
  it("blocks new sends for the cooldown window after an OTP maxes out its attempts", async () => {
    const code = await createOTP(USER, TYPE);
    for (let i = 0; i < 5; i++) {
      await verifyOTP(USER, TYPE, "000000" === code ? "111111" : "000000");
    }

    const canResend = await checkResendLimit(USER, TYPE);
    expect(canResend).toBe(false);
  });

  it("allows resends again once the cooldown window has passed", async () => {
    const code = await createOTP(USER, TYPE);
    for (let i = 0; i < 5; i++) {
      await verifyOTP(USER, TYPE, "000000" === code ? "111111" : "000000");
    }
    // Push the maxed-out row's createdAt back past the 15-minute cooldown.
    rows[0].createdAt = new Date(Date.now() - 16 * 60 * 1000);

    const canResend = await checkResendLimit(USER, TYPE);
    expect(canResend).toBe(true);
  });

  it("caps resends at 5 per rolling hour even without hitting the attempt lockout", async () => {
    for (let i = 0; i < 5; i++) await createOTP(USER, TYPE);
    const canResend = await checkResendLimit(USER, TYPE);
    expect(canResend).toBe(false);
  });
});

describe("createOTP", () => {
  it("invalidates the previous unused code when a new one is issued", async () => {
    const first = await createOTP(USER, TYPE);
    await createOTP(USER, TYPE);

    // The first code must no longer verify, even though it hasn't expired.
    const result = await verifyOTP(USER, TYPE, first);
    expect(result.success).toBe(false);
  });
});
