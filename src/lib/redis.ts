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
    retryStrategy: (times) => Math.min(times * 200, 2000),
  });
  client.on("error", (err) => {
    console.error("[Redis] connection error:", err.message);
  });

  return client;
}
