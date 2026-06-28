import { NextAuthOptions } from "next-auth";
import CredentialsProvider from "next-auth/providers/credentials";
import { PrismaAdapter } from "@auth/prisma-adapter";
import bcrypt from "bcryptjs";
import { prisma } from "@/lib/prisma";
import { UserRole, StaffDepartment } from "@prisma/client";
import type { Adapter } from "next-auth/adapters";

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
        email: { label: "Email", type: "email" },
        password: { label: "Password", type: "password" },
      },
      async authorize(credentials) {
        if (!credentials?.email || !credentials?.password) {
          throw new Error("Invalid credentials");
        }

        const user = await prisma.user.findUnique({
          where: { email: credentials.email.toLowerCase().trim() },
          include: { dealer: true, admin: true, vendor: true },
        });

        if (!user || !user.password) {
          throw new Error("Invalid credentials");
        }

        if (!user.isActive) {
          throw new Error("Account has been disabled. Contact support.");
        }

        if (user.accountLockedUntil && user.accountLockedUntil > new Date()) {
          const mins = Math.ceil((user.accountLockedUntil.getTime() - Date.now()) / 60000);
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
          throw new Error("Invalid credentials");
        }

        await prisma.user.update({
          where: { id: user.id },
          data: { failedLoginAttempts: 0, accountLockedUntil: null, lastLogin: new Date() },
        });

        if (user.role === UserRole.DEALER && user.dealer?.status !== "APPROVED") {
          const msgs: Record<string, string> = {
            PENDING: "Your dealer account is pending approval",
            REJECTED: "Your dealer application has been rejected",
            SUSPENDED: "Your dealer account has been suspended",
          };
          throw new Error(msgs[user.dealer?.status ?? ""] || "Account not approved");
        }

        if (user.role === UserRole.VENDOR && user.vendor?.status !== "APPROVED") {
          const msgs: Record<string, string> = {
            PENDING: "Your vendor account is pending approval",
            SUSPENDED: "Your vendor account has been suspended",
            BLACKLISTED: "Your vendor account has been blacklisted",
          };
          throw new Error(msgs[user.vendor?.status ?? ""] || "Account not approved");
        }

        return {
          id: user.id,
          email: user.email,
          name: user.name,
          role: user.role,
          dealerId: user.dealer?.id ?? undefined,
          isSuperAdmin: user.admin?.isSuperAdmin ?? false,
          vendorId: user.vendor?.id ?? undefined,
          department: user.department ?? undefined,
        };
      },
    }),
  ],
  callbacks: {
    async jwt({ token, user }) {
      if (user) {
        token.id = user.id;
        token.role = (user as { role: UserRole }).role;
        token.dealerId = (user as { dealerId?: string }).dealerId;
        token.isSuperAdmin = (user as { isSuperAdmin?: boolean }).isSuperAdmin ?? false;
        token.vendorId = (user as { vendorId?: string }).vendorId;
        token.department = (user as { department?: StaffDepartment }).department;
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
