import { SignJWT, jwtVerify } from "jose";

// No hardcoded fallback, and no falling back to NEXTAUTH_SECRET either: that
// used to be a fallback chain (`JWT_SECRET || NEXTAUTH_SECRET`), which meant
// a deploy that forgot to set JWT_SECRET would silently sign mobile/API
// tokens with NextAuth's secret instead of failing — two independent secrets
// collapsing into one without anyone noticing. JWT_SECRET is its own
// [REQUIRED] var (see ENVIRONMENT.md); fail loudly if it's missing rather
// than signing tokens with no secret or a borrowed one.
const secret = process.env.JWT_SECRET;
if (!secret) {
  throw new Error("JWT_SECRET must be set — refusing to boot with no secret configured for signing tokens");
}
const JWT_SECRET = new TextEncoder().encode(secret);
const ACCESS_TOKEN_EXPIRY = "15m";
const REFRESH_TOKEN_EXPIRY = "7d";

// Pinned so a token can't be replayed across contexts that might share this
// secret, and so verification only ever accepts the exact algorithm we sign
// with — jose already refuses alg:"none" outright, but being explicit here
// means a future change to the signing side can't silently widen what
// verification accepts.
const JWT_ALG = "HS256";
const JWT_ISSUER = "motoxplus-api";
const JWT_AUDIENCE = "motoxplus-app";

export interface JWTPayload {
  userId: string;
  email: string;
  role: string;
  sessionId: string;
}

export async function signAccessToken(payload: JWTPayload): Promise<string> {
  return new SignJWT({ ...payload, type: "access" })
    .setProtectedHeader({ alg: JWT_ALG })
    .setIssuedAt()
    .setIssuer(JWT_ISSUER)
    .setAudience(JWT_AUDIENCE)
    .setExpirationTime(ACCESS_TOKEN_EXPIRY)
    .sign(JWT_SECRET);
}

export async function signRefreshToken(payload: Pick<JWTPayload, "userId" | "sessionId">): Promise<string> {
  return new SignJWT({ ...payload, type: "refresh" })
    .setProtectedHeader({ alg: JWT_ALG })
    .setIssuedAt()
    .setIssuer(JWT_ISSUER)
    .setAudience(JWT_AUDIENCE)
    .setExpirationTime(REFRESH_TOKEN_EXPIRY)
    .sign(JWT_SECRET);
}

const VERIFY_OPTS = { algorithms: [JWT_ALG], issuer: JWT_ISSUER, audience: JWT_AUDIENCE };

export async function verifyAccessToken(token: string): Promise<JWTPayload | null> {
  try {
    const { payload } = await jwtVerify(token, JWT_SECRET, VERIFY_OPTS);
    if (payload.type !== "access") return null;
    return {
      userId: payload.userId as string,
      email: payload.email as string,
      role: payload.role as string,
      sessionId: payload.sessionId as string,
    };
  } catch {
    return null;
  }
}

export async function verifyRefreshToken(token: string): Promise<Pick<JWTPayload, "userId" | "sessionId"> | null> {
  try {
    const { payload } = await jwtVerify(token, JWT_SECRET, VERIFY_OPTS);
    if (payload.type !== "refresh") return null;
    return {
      userId: payload.userId as string,
      sessionId: payload.sessionId as string,
    };
  } catch {
    return null;
  }
}

export const COOKIE_ACCESS = "mx_access";
export const COOKIE_REFRESH = "mx_refresh";

export const ACCESS_TOKEN_MAX_AGE = 15 * 60; // 15 minutes in seconds
export const REFRESH_TOKEN_MAX_AGE = 7 * 24 * 60 * 60; // 7 days in seconds
