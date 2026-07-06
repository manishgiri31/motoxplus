import { withAuth } from "next-auth/middleware";
import { NextResponse } from "next/server";

const ADMIN_ROLES = ["ADMIN", "SUPER_ADMIN", "STAFF"];
const VERIFICATION_PAGES = ["/verify-email", "/verify-mobile", "/pending-approval"];

export default withAuth(
  function middleware(req) {
    const { pathname } = req.nextUrl;
    const token = req.nextauth.token;
    const role = token?.role as string;

    // Vendor portal — only VENDOR role
    if (pathname.startsWith("/vendor") && role !== "VENDOR") {
      return NextResponse.redirect(new URL("/login", req.url));
    }

    // Redirect vendors away from admin and dealer portals
    if ((pathname.startsWith("/admin") || pathname.startsWith("/dealer")) && role === "VENDOR") {
      return NextResponse.redirect(new URL("/vendor/dashboard", req.url));
    }

    // Redirect dealers away from admin
    if (pathname.startsWith("/admin") && role === "DEALER") {
      return NextResponse.redirect(new URL("/dealer/dashboard", req.url));
    }

    // Redirect admins away from dealer portal
    if (pathname.startsWith("/dealer") && ADMIN_ROLES.includes(role)) {
      return NextResponse.redirect(new URL("/admin/dashboard", req.url));
    }

    // Mandatory email/mobile verification + approval gating — dealers and vendors only.
    // A correct password always issues a session (see src/lib/auth.ts); this is
    // where we actually route unverified/unapproved users, instead of blocking login.
    if (
      (role === "DEALER" || role === "VENDOR") &&
      (pathname.startsWith("/dealer") || pathname.startsWith("/vendor")) &&
      !VERIFICATION_PAGES.some((p) => pathname.startsWith(p))
    ) {
      if (!token?.emailVerified) {
        return NextResponse.redirect(new URL(`/verify-email?userId=${token?.id}`, req.url));
      }
      if (!token?.mobileVerified) {
        return NextResponse.redirect(new URL("/verify-mobile", req.url));
      }
      const status = role === "DEALER" ? token?.dealerStatus : token?.vendorStatus;
      if (status !== "ACTIVE" && status !== "APPROVED") {
        return NextResponse.redirect(new URL("/pending-approval", req.url));
      }
    }

    // Redirect authenticated users away from auth pages
    const AUTH_PAGES = ["/login", "/register", "/forgot-password", "/reset-password"];
    if (AUTH_PAGES.some((p) => pathname === p) && token) {
      if (role === "DEALER") return NextResponse.redirect(new URL("/dealer/dashboard", req.url));
      if (ADMIN_ROLES.includes(role)) return NextResponse.redirect(new URL("/admin/dashboard", req.url));
      if (role === "VENDOR") return NextResponse.redirect(new URL("/vendor/dashboard", req.url));
    }

    return NextResponse.next();
  },
  {
    // getToken()'s own default cookie-name detection keys off whether
    // NEXTAUTH_URL starts with https:// — which is true even in local dev here
    // — while src/lib/auth.ts picks the cookie name off NODE_ENV. Without this
    // explicit override the two diverge locally and middleware never sees a
    // valid session (it works in production only because both defaults agree).
    cookies: {
      sessionToken: {
        name: process.env.NODE_ENV === "production" ? "__Secure-next-auth.session-token" : "next-auth.session-token",
      },
    },
    pages: {
      signIn: "/login",
    },
    callbacks: {
      authorized: ({ token, req }) => {
        const { pathname } = req.nextUrl;
        if (
          pathname.startsWith("/dealer") ||
          pathname.startsWith("/admin") ||
          pathname.startsWith("/vendor") ||
          VERIFICATION_PAGES.some((p) => pathname.startsWith(p))
        ) {
          return !!token;
        }
        return true;
      },
    },
  }
);

export const config = {
  matcher: [
    "/dealer/:path*",
    "/admin/:path*",
    "/vendor/:path*",
    "/login",
    "/register",
    "/forgot-password",
    "/reset-password",
    "/verify-email",
    "/verify-mobile",
    "/pending-approval",
  ],
};
