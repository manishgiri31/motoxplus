import { getRedis } from "@/lib/redis";
import { logger } from "@/lib/logger";
import { ShiprocketConfigError, ShiprocketAuthError } from "./errors";

const API_URL = process.env.SHIPROCKET_API_URL || "https://apiv2.shiprocket.in/v1/external";
const LOGIN_TIMEOUT_MS = 15000;

// Shiprocket's documented token validity is 240 hours (10 days) — see
// SECRET-ROTATION.md §8. One source reports a shorter 24h validity for some
// accounts; we don't rely on this TTL for correctness either way, only for
// avoiding an unnecessary login call. If the real token expires sooner than
// this, shiprocketFetch()'s 401-retry (client.ts) re-authenticates on the
// very next request — a stale TTL assumption degrades to one extra request,
// never to a silent failure.
const TOKEN_TTL_SECONDS = 9 * 24 * 60 * 60; // 9 days — safely under the 10-day docs figure
const TOKEN_KEY = "shiprocket:auth:token";

// Distributed lock so concurrent PM2 cluster workers that all miss the cache
// at the same moment don't each call Shiprocket's login endpoint at once.
// Only the worker holding the lock logs in; the rest poll for the token it
// publishes. The lock is intentionally never released early — it's left to
// expire on its own PX TTL, which is simpler and just as correct: peers
// don't need the lock to be free, only the token key to be populated, which
// happens immediately after a successful login, long before the lock times out.
const LOCK_KEY = "shiprocket:auth:lock";
const LOCK_TTL_MS = 20000;
const PEER_WAIT_TIMEOUT_MS = 20000;
const PEER_POLL_INTERVAL_MS = 250;

function isPlaceholder(value: string | undefined): boolean {
  return !value || value.startsWith("your_") || value.startsWith("replace_with") || value.includes("_here");
}

/**
 * Fails closed, loudly, with no fallback — this codebase has a history of
 * silent-fallback bugs (see the JWT_SECRET fallback removed in commit
 * 6846aef). A missing or placeholder credential here must never result in
 * a skipped/logged-only auth attempt; it must stop the caller.
 */
function assertConfigured(): { email: string; password: string } {
  const email = process.env.SHIPROCKET_EMAIL;
  const password = process.env.SHIPROCKET_PASSWORD;

  const missing = [
    isPlaceholder(email) && "SHIPROCKET_EMAIL",
    isPlaceholder(password) && "SHIPROCKET_PASSWORD",
  ].filter(Boolean);

  if (missing.length > 0) {
    throw new ShiprocketConfigError(
      `Shiprocket is not configured — missing or placeholder: ${missing.join(", ")}. Set both in .env; there is no fallback.`
    );
  }

  return { email: email!, password: password! };
}

function sleep(ms: number) {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

/**
 * Calls Shiprocket's login endpoint directly. Never logs the email,
 * password, or the returned token — only safe, non-credential fields ever
 * reach an error message or a log line.
 */
async function loginToShiprocket(): Promise<string> {
  const { email, password } = assertConfigured();

  let response: Response;
  try {
    response = await fetch(`${API_URL}/auth/login`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ email, password }),
      signal: AbortSignal.timeout(LOGIN_TIMEOUT_MS),
    });
  } catch (err) {
    throw new ShiprocketAuthError(
      `Shiprocket login request failed: ${err instanceof Error ? err.message : "network error"}`
    );
  }

  if (!response.ok) {
    // Only a known-safe field from the error body is ever surfaced — never
    // the raw body, in case it were ever to echo request data back.
    let safeMessage = `HTTP ${response.status}`;
    try {
      const body = await response.json();
      if (typeof body?.message === "string") safeMessage = body.message;
    } catch {
      // Unparsable body — keep the generic HTTP-status message.
    }
    logger.error("[Shiprocket] Login failed", { status: response.status, message: safeMessage });
    throw new ShiprocketAuthError(`Shiprocket login failed: ${safeMessage}`, response.status);
  }

  const data = await response.json().catch(() => null);
  if (!data || typeof data.token !== "string" || !data.token) {
    throw new ShiprocketAuthError("Shiprocket login response did not include a token");
  }

  logger.info("[Shiprocket] Login succeeded, token cached");
  return data.token;
}

// In-process fallback used only when REDIS_URL isn't configured — each PM2
// worker then caches and single-flights independently, same degrade pattern
// already established by src/lib/auth/rate-limit.ts for the same reason.
let inProcessCache: { token: string; expiresAt: number } | null = null;
let inFlightLogin: Promise<string> | null = null;
let warnedNoRedis = false;

async function getTokenInProcessOnly(): Promise<string> {
  if (!warnedNoRedis) {
    warnedNoRedis = true;
    logger.warn("[Shiprocket] REDIS_URL not set — token cache and login single-flight are per-worker only");
  }

  if (inProcessCache && inProcessCache.expiresAt > Date.now()) {
    return inProcessCache.token;
  }

  if (inFlightLogin) return inFlightLogin;

  inFlightLogin = (async () => {
    const token = await loginToShiprocket();
    inProcessCache = { token, expiresAt: Date.now() + TOKEN_TTL_SECONDS * 1000 };
    return token;
  })();

  try {
    return await inFlightLogin;
  } finally {
    inFlightLogin = null;
  }
}

async function waitForTokenFromPeer(redis: NonNullable<ReturnType<typeof getRedis>>): Promise<string> {
  const deadline = Date.now() + PEER_WAIT_TIMEOUT_MS;
  while (Date.now() < deadline) {
    await sleep(PEER_POLL_INTERVAL_MS);
    const token = await redis.get(TOKEN_KEY);
    if (token) return token;
  }
  throw new ShiprocketAuthError("Timed out waiting for another worker to complete Shiprocket login");
}

async function acquireTokenWithDistributedLock(redis: NonNullable<ReturnType<typeof getRedis>>): Promise<string> {
  const acquired = await redis.set(LOCK_KEY, "1", "PX", LOCK_TTL_MS, "NX");

  if (acquired !== "OK") {
    // Another worker is already logging in — wait for it instead of also
    // calling the login endpoint ourselves.
    return waitForTokenFromPeer(redis);
  }

  const token = await loginToShiprocket();
  await redis.set(TOKEN_KEY, token, "EX", TOKEN_TTL_SECONDS);
  return token;
}

/**
 * Returns a valid Shiprocket bearer token, from cache when possible.
 * Single-flights both within this process and across PM2 cluster workers
 * (via Redis, when configured) so a cold cache never causes a login
 * stampede. Throws ShiprocketConfigError if credentials are unset, or
 * ShiprocketAuthError if the login call itself fails.
 */
export async function getShiprocketToken(): Promise<string> {
  assertConfigured();

  const redis = getRedis();
  if (!redis) {
    return getTokenInProcessOnly();
  }

  const cached = await redis.get(TOKEN_KEY);
  if (cached) return cached;

  if (inFlightLogin) return inFlightLogin;

  inFlightLogin = acquireTokenWithDistributedLock(redis);
  try {
    return await inFlightLogin;
  } finally {
    inFlightLogin = null;
  }
}

/** Drops the cached token (in-process and Redis) so the next call re-authenticates. */
export async function invalidateShiprocketToken(): Promise<void> {
  inProcessCache = null;
  const redis = getRedis();
  if (redis) {
    await redis.del(TOKEN_KEY).catch((err) => {
      logger.error("[Shiprocket] Failed to invalidate cached token in Redis", { error: err instanceof Error ? err.message : String(err) });
    });
  }
}
