import Redis from "ioredis";

let client: Redis | null | undefined;

/**
 * Lazily creates a shared ioredis client when REDIS_URL is configured, or
 * returns null so callers can fall back to an in-process alternative.
 * Connection errors are logged but never thrown from here — callers decide
 * how to degrade (see rate-limit.ts's in-memory fallback).
 */
export function getRedis(): Redis | null {
  if (client !== undefined) return client;

  const url = process.env.REDIS_URL;
  if (!url) {
    client = null;
    return client;
  }

  client = new Redis(url, {
    maxRetriesPerRequest: 1,
    // ioredis's default (queue commands while disconnected, replay on
    // reconnect) is wrong for a rate limiter mid-request: a command issued
    // while Redis is down would sit queued rather than rejecting, so the
    // catch-and-fall-back-to-in-memory logic in rate-limit.ts would never
    // run — the request would just hang until reconnect. Disabling the
    // queue makes commands reject immediately when not connected.
    enableOfflineQueue: false,
    // Belt-and-suspenders: bounds how long a single command can take even if
    // the socket looks open but Redis itself is wedged (frozen process,
    // network partition that hasn't yet triggered a TCP-level error).
    commandTimeout: 1000,
    retryStrategy: (times) => Math.min(times * 200, 2000),
  });
  client.on("error", (err) => {
    console.error("[Redis] connection error:", err.message);
  });

  return client;
}

export type RedisStatus =
  | { status: "ok"; latencyMs: number }
  /** REDIS_URL is not set: rate limits use the per-process in-memory fallback by design. */
  | { status: "disabled" }
  /** `reason` is a short fixed code, safe to show on a public endpoint; details go to the server log. */
  | { status: "error"; latencyMs: number; reason: "unreachable" | "timeout" | "unexpected-reply" };

/** Resolves once the client is "ready" or after `timeoutMs`, whichever is first, leaving no listener behind. */
function waitUntilReady(redis: Redis, timeoutMs: number): Promise<void> {
  if (redis.status === "ready") return Promise.resolve();
  return new Promise((resolve) => {
    const onReady = () => {
      clearTimeout(timer);
      resolve();
    };
    const timer = setTimeout(() => {
      redis.removeListener("ready", onReady);
      resolve();
    }, timeoutMs);
    redis.once("ready", onReady);
  });
}

/**
 * Actively verifies Redis with a real PING, rather than only checking that REDIS_URL is set - the old
 * boot log said "Rate limiter: Redis" whenever the variable existed, even while nothing was listening,
 * so a Redis that was never installed silently disabled every shared rate limit.
 *
 * Waits briefly for the lazy client to finish connecting first: with enableOfflineQueue:false (see above)
 * a command issued mid-handshake is rejected outright, which would report a healthy Redis as down.
 * Never throws.
 */
export async function checkRedis(timeoutMs = 1500): Promise<RedisStatus> {
  const redis = getRedis();
  if (!redis) return { status: "disabled" };

  const started = Date.now();
  try {
    await waitUntilReady(redis, timeoutMs);
    if (redis.status !== "ready") {
      console.error(`[Redis] health check: not connected (client status: ${redis.status})`);
      return { status: "error", latencyMs: Date.now() - started, reason: Date.now() - started >= timeoutMs ? "timeout" : "unreachable" };
    }
    const reply = await redis.ping();
    if (reply !== "PONG") {
      console.error(`[Redis] health check: unexpected PING reply: ${String(reply)}`);
      return { status: "error", latencyMs: Date.now() - started, reason: "unexpected-reply" };
    }
    return { status: "ok", latencyMs: Date.now() - started };
  } catch (err) {
    console.error("[Redis] health check failed:", err instanceof Error ? err.message : err);
    return { status: "error", latencyMs: Date.now() - started, reason: "unreachable" };
  }
}
