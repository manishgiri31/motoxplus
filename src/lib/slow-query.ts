/**
 * Slow-query logging helpers for the Prisma client (wired up in prisma.ts).
 *
 * Only the SQL TEXT is ever logged - never the bound parameters. Prisma sends values as $1, $2 ... so the
 * text carries no data, whereas `params` would put emails, phone numbers, OTP hashes and bcrypt password
 * hashes into the PM2 log files.
 */

/** Queries slower than this are logged. Override with SLOW_QUERY_MS (e.g. 100 while tuning, 0 to log all). */
export const DEFAULT_SLOW_QUERY_MS = 200;

/** Longest SQL text written to a log line. */
const MAX_LOGGED_SQL_LENGTH = 1500;

export function slowQueryThresholdMs(env: Record<string, string | undefined> = process.env): number {
  const raw = env.SLOW_QUERY_MS;
  if (raw === undefined || raw.trim() === "") return DEFAULT_SLOW_QUERY_MS;
  const n = Number(raw);
  return Number.isFinite(n) && n >= 0 ? n : DEFAULT_SLOW_QUERY_MS;
}

/**
 * Collapses a query to its "shape" so the same statement with different values groups together:
 * whitespace is squeezed, every placeholder becomes `$?`, and `IN ($1,$2,...)` lists of any length become
 * `IN ($?...)`. Two calls with different filters/ids but the same structure yield the same string.
 */
export function normalizeQueryShape(sql: string): string {
  return sql
    .replace(/\s+/g, " ")
    .replace(/\bIN\s*\(\s*\$\d+(?:\s*,\s*\$\d+)*\s*\)/gi, "IN ($?...)")
    .replace(/\$\d+/g, "$?")
    .trim();
}

export interface SlowQueryEvent {
  /** SQL text with $n placeholders. */
  query: string;
  /** Milliseconds. */
  duration: number;
  target?: string;
}

/** Returns the structured log fields for a query event if it breached the threshold, else null. */
export function describeSlowQuery(
  e: SlowQueryEvent,
  thresholdMs: number = slowQueryThresholdMs()
): { durationMs: number; thresholdMs: number; shape: string; target?: string } | null {
  // At or above the threshold is "slow"; NaN/undefined durations never qualify.
  if (!(e.duration >= thresholdMs)) return null;
  const shape = normalizeQueryShape(e.query);
  return {
    durationMs: e.duration,
    thresholdMs,
    shape: shape.length > MAX_LOGGED_SQL_LENGTH ? shape.slice(0, MAX_LOGGED_SQL_LENGTH) + "...[truncated]" : shape,
    target: e.target,
  };
}
