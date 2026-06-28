/**
 * Structured logger for production.
 * In production: emits newline-delimited JSON to stdout (PM2 captures it).
 * In development: pretty-prints to console.
 * Never use console.log / console.error directly in application code.
 */

type LogLevel = "debug" | "info" | "warn" | "error";

interface LogEntry {
  ts: string;
  level: LogLevel;
  msg: string;
  [key: string]: unknown;
}

const isProd = process.env.NODE_ENV === "production";

function write(level: LogLevel, msg: string, meta?: Record<string, unknown>) {
  const entry: LogEntry = {
    ts: new Date().toISOString(),
    level,
    msg,
    ...meta,
  };

  if (isProd) {
    process.stdout.write(JSON.stringify(entry) + "\n");
  } else {
    const colors: Record<LogLevel, string> = {
      debug: "\x1b[36m",
      info: "\x1b[32m",
      warn: "\x1b[33m",
      error: "\x1b[31m",
    };
    const reset = "\x1b[0m";
    const prefix = `${colors[level]}[${level.toUpperCase()}]${reset}`;
    const metaStr = meta && Object.keys(meta).length ? " " + JSON.stringify(meta) : "";
    console.log(`${prefix} ${msg}${metaStr}`);
  }
}

export const logger = {
  debug: (msg: string, meta?: Record<string, unknown>) => write("debug", msg, meta),
  info: (msg: string, meta?: Record<string, unknown>) => write("info", msg, meta),
  warn: (msg: string, meta?: Record<string, unknown>) => write("warn", msg, meta),
  error: (msg: string, meta?: Record<string, unknown>) => write("error", msg, meta),
};

/** Log an API request — call at the start of each route handler. */
export function logRequest(
  method: string,
  path: string,
  meta?: Record<string, unknown>
) {
  logger.info(`${method} ${path}`, meta);
}

/** Log an API error — call in catch blocks before returning 5xx. */
export function logError(
  msg: string,
  err: unknown,
  meta?: Record<string, unknown>
) {
  const errMeta: Record<string, unknown> = {
    ...meta,
    error: err instanceof Error ? err.message : String(err),
  };
  if (err instanceof Error && err.stack && !isProd) {
    errMeta.stack = err.stack;
  }
  logger.error(msg, errMeta);
}
