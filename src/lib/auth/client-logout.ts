"use client";

import { signOut } from "next-auth/react";

// Password login via NextAuth signIn() only ever sets the NextAuth cookie,
// so plain signOut() was enough there. Now that OTP/REST login also
// establish the canonical mx_access/mx_refresh session (see web-session.ts),
// signOut() alone would clear the NextAuth cookie but leave that session's
// cookies and its UserSession row live. Every logout button should call this
// instead of signOut() directly.
export async function fullLogout(callbackUrl = "/") {
  await fetch("/api/auth/logout", { method: "POST" }).catch(() => {});
  await signOut({ callbackUrl });
}
