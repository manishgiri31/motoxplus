import "@/lib/env"; // validate env vars on every cold start
import { PrismaClient } from "@prisma/client";
import { describeSlowQuery, slowQueryThresholdMs } from "@/lib/slow-query";

const globalForPrisma = globalThis as unknown as {
  prisma: PrismaClient | undefined;
  slowQueryLoggingAttached: boolean | undefined;
};

function createClient(): PrismaClient {
  const isProd = process.env.NODE_ENV === "production";

  return new PrismaClient({
    log: isProd
      ? [
        { emit: "event", level: "error" },
        // Subscribed below only to log queries over SLOW_QUERY_MS (default 200ms); fast queries are dropped.
        { emit: "event", level: "query" },
      ]
      : [
        { emit: "event", level: "error" },
        { emit: "event", level: "warn" },
        { emit: "event", level: "query" },
      ],
  });
}

export const prisma = globalForPrisma.prisma ?? createClient();

if (process.env.NODE_ENV !== "production") {
  globalForPrisma.prisma = prisma;
}

// Log slow queries to stdout for PM2 to capture. Parameters are deliberately not logged (see slow-query.ts).
// Guarded by a global flag: in dev the client survives hot reloads, and re-running this module would stack a
// duplicate handler on it for every reload.
if (!globalForPrisma.slowQueryLoggingAttached) {
  globalForPrisma.slowQueryLoggingAttached = true;
  const thresholdMs = slowQueryThresholdMs();
  (prisma as PrismaClient).$on("query" as never, (e: { query: string; duration: number; target: string }) => {
    const slow = describeSlowQuery(e, thresholdMs);
    if (!slow) return;
    console.warn(JSON.stringify({ ts: new Date().toISOString(), level: "warn", msg: "Slow query", ...slow }));
  });
}

if (process.env.NODE_ENV === "production") {
  (prisma as PrismaClient).$on("error" as never, (e: { message: string; target: string }) => {
    console.error(
      JSON.stringify({ ts: new Date().toISOString(), level: "error", msg: "Prisma error", target: e.target, error: e.message })
    );
  });
}
