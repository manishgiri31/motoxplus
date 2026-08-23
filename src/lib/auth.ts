import { NextAuthOptions } from "next-auth";
import CredentialsProvider from "next-auth/providers/credentials";
import { PrismaAdapter } from "@auth/prisma-adapter";
import { prisma } from "@/lib/prisma";
import { UserRole, StaffDepartment } from "@prisma/client";
import type { Adapter } from "next-auth/adapters";
import { authenticateWithPassword } from "@/lib/auth/credentials";
import { createSession } from "@/lib/auth/session";
import { buildSessionClaims } from "@/lib/auth/identity";

function getClientIP(headers?: Record<string, any>): string | undefined {
  const forwarded = headers?.["x-forwarded-for"];
  if (typeof forwarded === "string") return forwarded.split(",")[0]?.trim();
  return (headers?.["x-real-ip"] as string) || undefined;
}

function getDeviceInfo(headers?: Record<string, any>): string {
  const ua = (headers?.["user-agent"] as string) || "unknown";
  if (ua.includes("Mobile")) return "Mobile";
  if (ua.includes("Tablet")) return "Tablet";
  return "Desktop";
}

export const authOptions: NextAuthOptions = {
  adapter: PrismaAdapter(prisma) as Adapter,
  secret: process.env.NEXTAUTH_SECRET,
  session: {
    strategy: "jwt",
    // 8 hours in production; 30 days in dev for convenience
    maxAge: process.env.NODE_ENV === "production" ? 8 * 60 * 60 : 30 * 24 * 60 * 60,
    updateAge: 60 * 60, // refresh token every hour
  },
  pages: {
    signIn: "/login",
    error: "/login",
  },
  providers: [
    CredentialsProvider({
      name: "credentials",
      credentials: {
        identifier: { label: "Email or Mobile", type: "text" },
        password: { label: "Password", type: "password" },
      },
      async authorize(credentials, req) {
        if (!credentials?.identifier || !credentials?.password) {
          throw new Error("Invalid credentials");
        }

        const ip = getClientIP(req?.headers);
        const deviceInfo = getDeviceInfo(req?.headers);
        const userAgent = (req?.headers?.["user-agent"] as string) || undefined;

        // Delegates identifier normalization, rate limiting, lockout, and
        // audit logging to the same function /api/auth/login and
        // /api/mobile/auth/login use — this used to be a third hand-copied
        // implementation of all of that.
        const result = await authenticateWithPassword({
          identifierRaw: credentials.identifier,
          password: credentials.password,
          ipAddress: ip,
          userAgent,
          deviceInfo,
        });

        if (!result.ok) {
          throw new Error(result.message);
        }

        const { user } = result;

        // Converges this login onto the same canonical UserSession record
        // (see src/lib/auth/session.ts) that REST/OTP logins create — every
        // authentication method now produces exactly one session row, even
        // though NextAuth's own JWT cookie (minted below via the jwt/session
        // callbacks) remains what actually gates page access for this flow.
        const { sessionId } = await createSession({ userId: user.id, email: user.email, role: user.role, ipAddress: ip, userAgent, deviceInfo });

        // Email/mobile verification and dealer/vendor approval are enforced by
        // middleware redirects, not here — a correct password always issues a
        // session so the user can be routed to the right verification step.
        return {
          ...buildSessionClaims(user),
          email: user.email,
          name: user.name,
          sessionId,
        };
      },
    }),
  ],
  callbacks: {
    async jwt({ token, user, trigger }) {
      if (user) {
        token.id = user.id;
        token.role = (user as { role: UserRole }).role;
        token.dealerId = (user as { dealerId?: string }).dealerId;
        token.isSuperAdmin = (user as { isSuperAdmin?: boolean }).isSuperAdmin ?? false;
        token.vendorId = (user as { vendorId?: string }).vendorId;
        token.department = (user as { department?: StaffDepartment }).department;
        token.emailVerified = (user as { emailVerified?: boolean }).emailVerified;
        token.mobileVerified = (user as { mobileVerified?: boolean }).mobileVerified;
        token.dealerStatus = (user as { dealerStatus?: string }).dealerStatus;
        token.vendorStatus = (user as { vendorStatus?: string }).vendorStatus;
        token.sessionId = (user as { sessionId?: string }).sessionId;
      }

      // Triggered by the client's `useSession().update()` right after email/mobile
      // verification completes — re-reads verification/approval status from the DB
      // so the middleware gate reflects it immediately instead of waiting for the
      // token's normal refresh interval.
      if (trigger === "update" && token.id) {
        const fresh = await prisma.user.findUnique({
          where: { id: token.id as string },
          include: { dealer: true, vendor: true },
        });
        if (fresh) {
          token.emailVerified = !!fresh.emailVerified;
          token.mobileVerified = fresh.mobileVerified;
          token.dealerStatus = fresh.dealer?.status ?? undefined;
          token.vendorStatus = fresh.vendor?.status ?? undefined;
        }
      }

      return token;
    },
    async session({ session, token }) {
      if (token) {
        session.user.id = token.id as string;
        session.user.role = token.role as UserRole;
        session.user.dealerId = token.dealerId as string | undefined;
        session.user.isSuperAdmin = token.isSuperAdmin as boolean | undefined;
        session.user.vendorId = token.vendorId as string | undefined;
        session.user.department = token.department as StaffDepartment | undefined;
        session.user.emailVerified = token.emailVerified as boolean | undefined;
        session.user.mobileVerified = token.mobileVerified as boolean | undefined;
        session.user.dealerStatus = token.dealerStatus as string | undefined;
        session.user.vendorStatus = token.vendorStatus as string | undefined;
      }
      return session;
    },
  },
  // Cookie hardening
  cookies: {
    sessionToken: {
      name: process.env.NODE_ENV === "production" ? "__Secure-next-auth.session-token" : "next-auth.session-token",
      options: {
        httpOnly: true,
        sameSite: "lax",
        path: "/",
        secure: process.env.NODE_ENV === "production",
      },
    },
  },
};
