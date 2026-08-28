import { NextRequest } from "next/server";
import { getServerSession } from "next-auth";
import { authOptions } from "@/lib/auth";
import { getAuthUser, extractAccessToken } from "./middleware";

// The web app authenticates via NextAuth (session cookie); the native mobile
// app and any Bearer-token clients authenticate via the custom JWT issued by
// /api/mobile/auth/login. Routes shared by both (e.g. mobile verification)
// need to resolve whichever session is present.
export async function getCurrentUserId(req: NextRequest): Promise<string | null> {
  // If a custom-JWT access token is present at all (mx_access cookie or Bearer
  // header), this is an API/mobile client — resolve it via getAuthUser and do
  // NOT fall through to the NextAuth cookie. Falling through would let a
  // revoked/disabled session (getAuthUser → null after the F-14 session check)
  // keep access through the still-valid NextAuth cookie the web login also set.
  if (extractAccessToken(req)) {
    const jwtUser = await getAuthUser(req);
    return jwtUser?.userId ?? null;
  }

  const session = await getServerSession(authOptions);
  return session?.user?.id ?? null;
}
