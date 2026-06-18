import { NextAuthOptions } from "next-auth";
import CredentialsProvider from "next-auth/providers/credentials";
import { PrismaAdapter } from "@auth/prisma-adapter";
import bcrypt from "bcryptjs";
import { prisma } from "@/lib/prisma";
import { UserRole } from "@prisma/client";

export const authOptions: NextAuthOptions = {
  adapter: PrismaAdapter(prisma) as any,
  session: {
    strategy: "jwt",
    maxAge: 30 * 24 * 60 * 60, // 30 days
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
          where: { email: credentials.email },
          include: {
            dealer: true,
            admin: true,
            vendor: true,
          },
        });

        if (!user || !user.password) {
          throw new Error("Invalid credentials");
        }

        const isValid = await bcrypt.compare(credentials.password, user.password);
        if (!isValid) {
          throw new Error("Invalid credentials");
        }

        // Check dealer approval
        if (user.role === UserRole.DEALER && user.dealer?.status !== "APPROVED") {
          if (user.dealer?.status === "PENDING") {
            throw new Error("Your dealer account is pending approval");
          }
          if (user.dealer?.status === "REJECTED") {
            throw new Error("Your dealer application has been rejected");
          }
          if (user.dealer?.status === "SUSPENDED") {
            throw new Error("Your dealer account has been suspended");
          }
        }

        // Check vendor approval
        if (user.role === UserRole.VENDOR && user.vendor?.status !== "APPROVED") {
          if (user.vendor?.status === "PENDING") {
            throw new Error("Your vendor account is pending approval");
          }
          if (user.vendor?.status === "SUSPENDED") {
            throw new Error("Your vendor account has been suspended");
          }
          if (user.vendor?.status === "BLACKLISTED") {
            throw new Error("Your vendor account has been blacklisted");
          }
        }

        return {
          id: user.id,
          email: user.email,
          name: user.name,
          role: user.role,
          dealerId: user.dealer?.id,
          isSuperAdmin: user.admin?.isSuperAdmin,
          vendorId: user.vendor?.id,
          department: user.department ?? undefined,
        };
      },
    }),
  ],
  callbacks: {
    async jwt({ token, user }) {
      if (user) {
        token.id = user.id;
        token.role = (user as any).role;
        token.dealerId = (user as any).dealerId;
        token.isSuperAdmin = (user as any).isSuperAdmin;
        token.vendorId = (user as any).vendorId;
        token.department = (user as any).department;
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
        session.user.department = token.department as any;
      }
      return session;
    },
  },
};
