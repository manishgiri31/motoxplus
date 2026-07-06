import { NextAuthOptions } from "next-auth";
import CredentialsProvider from "next-auth/providers/credentials";
import { PrismaAdapter } from "@auth/prisma-adapter";
import bcrypt from "bcryptjs";
import { prisma } from "@/lib/prisma";
import { UserRole, StaffDepartment } from "@prisma/client";
import type { Adapter } from "next-auth/adapters";

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

        const identifier = credentials.identifier.trim();
        const isMobile = /^[6-9]\d{9}$/.test(identifier.replace(/\s/g, "").replace("+91", ""));

        const user = await prisma.user.findUnique({
          where: isMobile
            ? { mobileNumber: identifier.replace(/\s/g, "").replace("+91", "") }
            : { email: identifier.toLowerCase() },
          include: { dealer: true, admin: true, vendor: true },
        });

        const logFailure = async (userId: string | undefined, reason: string) => {
          if (!userId) return;
          await prisma.loginHistory.create({
            data: { userId, success: false, method: isMobile ? "password-mobile" : "password-email", reason, ipAddress: ip, userAgent, deviceInfo },
          }).catch(() => null);
        };

        if (!user || !user.password) {
          throw new Error("Invalid credentials");
        }

        if (!user.isActive) {
          await logFailure(user.id, "Account disabled");
          throw new Error("Account has been disabled. Contact support.");
        }

        if (user.accountLockedUntil && user.accountLockedUntil > new Date()) {
          const mins = Math.ceil((user.accountLockedUntil.getTime() - Date.now()) / 60000);
          await logFailure(user.id, "Account locked");
          throw new Error(`Account locked. Try again in ${mins} minutes.`);
        }

        const isValid = await bcrypt.compare(credentials.password, user.password);
        if (!isValid) {
          const newAttempts = (user.failedLoginAttempts || 0) + 1;
          const updates: Record<string, unknown> = { failedLoginAttempts: newAttempts };
          if (newAttempts >= 5) {
            updates.accountLockedUntil = new Date(Date.now() + 30 * 60 * 1000);
          }
          await prisma.user.update({ where: { id: user.id }, data: updates });
          await logFailure(user.id, "Incorrect password");
          throw new Error("Invalid credentials");
        }

        await prisma.user.update({
          where: { id: user.id },
          data: {
            failedLoginAttempts: 0,
            accountLockedUntil: null,
            lastLogin: new Date(),
            lastLoginIP: ip,
            lastDevice: deviceInfo,
          },
        });

        await prisma.loginHistory.create({
          data: {
            userId: user.id,
            success: true,
            method: isMobile ? "password-mobile" : "password-email",
            ipAddress: ip,
            userAgent,
            deviceInfo,
          },
        }).catch(() => null);

        // Email/mobile verification and dealer/vendor approval are enforced by
        // middleware redirects, not here — a correct password always issues a
        // session so the user can be routed to the right verification step.
        return {
          id: user.id,
          email: user.email,
          name: user.name,
          role: user.role,
          dealerId: user.dealer?.id ?? undefined,
          isSuperAdmin: user.admin?.isSuperAdmin ?? false,
          vendorId: user.vendor?.id ?? undefined,
          department: user.department ?? undefined,
          emailVerified: !!user.emailVerified,
          mobileVerified: user.mobileVerified,
          dealerStatus: user.dealer?.status ?? undefined,
          vendorStatus: user.vendor?.status ?? undefined,
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
