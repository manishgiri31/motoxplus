import { NextRequest } from "next/server";
import { getServerSession } from "next-auth";
import { authOptions } from "@/lib/auth";
import { getAuthUser } from "./middleware";

// The web app authenticates via NextAuth (session cookie); the native mobile
// app and any Bearer-token clients authenticate via the custom JWT issued by
// /api/mobile/auth/login. Routes shared by both (e.g. mobile verification)
// need to resolve whichever session is present.
export async function getCurrentUserId(req: NextRequest): Promise<string | null> {
  const jwtUser = await getAuthUser(req);
  if (jwtUser) return jwtUser.userId;

  const session = await getServerSession(authOptions);
  return session?.user?.id ?? null;
}
