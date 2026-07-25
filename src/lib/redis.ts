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
