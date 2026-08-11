import { describe, it, expect, beforeEach, afterEach, vi } from "vitest";
import { SignJWT } from "jose";

const ORIGINAL_JWT_SECRET = process.env.JWT_SECRET;
const ORIGINAL_NEXTAUTH_SECRET = process.env.NEXTAUTH_SECRET;

async function freshJwtModule() {
  vi.resetModules();
  return import("./jwt");
}

afterEach(() => {
  process.env.JWT_SECRET = ORIGINAL_JWT_SECRET;
  process.env.NEXTAUTH_SECRET = ORIGINAL_NEXTAUTH_SECRET;
});

describe("boot-time secret validation", () => {
  it("refuses to load when JWT_SECRET is unset", async () => {
    delete process.env.JWT_SECRET;
    delete process.env.NEXTAUTH_SECRET;
    await expect(freshJwtModule()).rejects.toThrow(/JWT_SECRET must be set/);
  });

  it("refuses to load even if NEXTAUTH_SECRET is set but JWT_SECRET is not (no silent fallback)", async () => {
    delete process.env.JWT_SECRET;
    process.env.NEXTAUTH_SECRET = "a".repeat(32);
    await expect(freshJwtModule()).rejects.toThrow(/JWT_SECRET must be set/);
  });

  it("loads fine once JWT_SECRET is set", async () => {
    process.env.JWT_SECRET = "b".repeat(32);
    await expect(freshJwtModule()).resolves.toBeDefined();
  });
});

describe("signing and verification", () => {
  beforeEach(() => {
    process.env.JWT_SECRET = "c".repeat(32);
  });

  it("round-trips a valid access token", async () => {
    const { signAccessToken, verifyAccessToken } = await freshJwtModule();
    const token = await signAccessToken({ userId: "u1", email: "a@b.com", role: "DEALER", sessionId: "s1" });
    const payload = await verifyAccessToken(token);
    expect(payload).toMatchObject({ userId: "u1", email: "a@b.com", role: "DEALER", sessionId: "s1" });
  });

  it("rejects a refresh token presented as an access token (type confusion)", async () => {
    const { signRefreshToken, verifyAccessToken } = await freshJwtModule();
    const refresh = await signRefreshToken({ userId: "u1", sessionId: "s1" });
    expect(await verifyAccessToken(refresh)).toBeNull();
  });

  it("rejects a token signed with a different secret", async () => {
    const { verifyAccessToken } = await freshJwtModule();
    const forged = await new SignJWT({ userId: "u1", email: "a@b.com", role: "ADMIN", sessionId: "s1", type: "access" })
      .setProtectedHeader({ alg: "HS256" })
      .setIssuedAt()
      .setIssuer("motoxplus-api")
      .setAudience("motoxplus-app")
      .setExpirationTime("15m")
      .sign(new TextEncoder().encode("wrong-secret-wrong-secret-wrong"));

    expect(await verifyAccessToken(forged)).toBeNull();
  });

  it("rejects a token with a mismatched issuer or audience even when correctly signed", async () => {
    const { verifyAccessToken } = await freshJwtModule();
    const secret = new TextEncoder().encode(process.env.JWT_SECRET!);

    const wrongIssuer = await new SignJWT({ userId: "u1", email: "a@b.com", role: "ADMIN", sessionId: "s1", type: "access" })
      .setProtectedHeader({ alg: "HS256" })
      .setIssuedAt()
      .setIssuer("some-other-service")
      .setAudience("motoxplus-app")
      .setExpirationTime("15m")
      .sign(secret);
    expect(await verifyAccessToken(wrongIssuer)).toBeNull();

    const wrongAudience = await new SignJWT({ userId: "u1", email: "a@b.com", role: "ADMIN", sessionId: "s1", type: "access" })
      .setProtectedHeader({ alg: "HS256" })
      .setIssuedAt()
      .setIssuer("motoxplus-api")
      .setAudience("some-other-app")
      .setExpirationTime("15m")
      .sign(secret);
    expect(await verifyAccessToken(wrongAudience)).toBeNull();
  });

  it("rejects an unsigned alg:none token (algorithm confusion / signature stripping)", async () => {
    const { verifyAccessToken } = await freshJwtModule();
    const header = Buffer.from(JSON.stringify({ alg: "none", typ: "JWT" })).toString("base64url");
    const body = Buffer.from(
      JSON.stringify({ userId: "u1", email: "a@b.com", role: "SUPER_ADMIN", sessionId: "s1", type: "access", iss: "motoxplus-api", aud: "motoxplus-app" })
    ).toString("base64url");
    const noneToken = `${header}.${body}.`;

    expect(await verifyAccessToken(noneToken)).toBeNull();
  });

  it("rejects an expired token", async () => {
    const { verifyAccessToken } = await freshJwtModule();
    const secret = new TextEncoder().encode(process.env.JWT_SECRET!);
    const expired = await new SignJWT({ userId: "u1", email: "a@b.com", role: "DEALER", sessionId: "s1", type: "access" })
      .setProtectedHeader({ alg: "HS256" })
      .setIssuedAt(Math.floor(Date.now() / 1000) - 3600)
      .setIssuer("motoxplus-api")
      .setAudience("motoxplus-app")
      .setExpirationTime(Math.floor(Date.now() / 1000) - 1800)
      .sign(secret);

    expect(await verifyAccessToken(expired)).toBeNull();
  });
});
