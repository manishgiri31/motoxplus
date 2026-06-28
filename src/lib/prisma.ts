import "@/lib/env"; // validate env vars on every cold start
import { PrismaClient } from "@prisma/client";

const globalForPrisma = globalThis as unknown as {
  prisma: PrismaClient | undefined;
};

function createClient(): PrismaClient {
  const isProd = process.env.NODE_ENV === "production";

  return new PrismaClient({
    log: isProd
      ? [{ emit: "event", level: "error" }]
      : [
          { emit: "event", level: "error" },
          { emit: "event", level: "warn" },
          // Uncomment during query optimization:
          // { emit: "event", level: "query" },
        ],
  });
}

export const prisma = globalForPrisma.prisma ?? createClient();

if (process.env.NODE_ENV !== "production") {
  globalForPrisma.prisma = prisma;
}

// Log slow queries to stdout in production for PM2 to capture
if (process.env.NODE_ENV === "production") {
  (prisma as PrismaClient).$on("error" as never, (e: { message: string; target: string }) => {
    console.error(
      JSON.stringify({ ts: new Date().toISOString(), level: "error", msg: "Prisma error", target: e.target, error: e.message })
    );
  });
}
