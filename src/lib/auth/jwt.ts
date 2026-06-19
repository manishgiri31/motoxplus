import { SignJWT, jwtVerify } from "jose";

const JWT_SECRET = new TextEncoder().encode(
  process.env.JWT_SECRET || process.env.NEXTAUTH_SECRET || "fallback-secret-change-in-production"
);
const ACCESS_TOKEN_EXPIRY = "15m";
const REFRESH_TOKEN_EXPIRY = "7d";

export interface JWTPayload {
  userId: string;
  email: string;
  role: string;
  sessionId: string;
}

export async function signAccessToken(payload: JWTPayload): Promise<string> {
  return new SignJWT({ ...payload, type: "access" })
    .setProtectedHeader({ alg: "HS256" })
    .setIssuedAt()
    .setExpirationTime(ACCESS_TOKEN_EXPIRY)
    .sign(JWT_SECRET);
}

export async function signRefreshToken(payload: Pick<JWTPayload, "userId" | "sessionId">): Promise<string> {
  return new SignJWT({ ...payload, type: "refresh" })
    .setProtectedHeader({ alg: "HS256" })
    .setIssuedAt()
    .setExpirationTime(REFRESH_TOKEN_EXPIRY)
    .sign(JWT_SECRET);
}

export async function verifyAccessToken(token: string): Promise<JWTPayload | null> {
  try {
    const { payload } = await jwtVerify(token, JWT_SECRET);
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
    const { payload } = await jwtVerify(token, JWT_SECRET);
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
