import { withAuth } from "next-auth/middleware";
import { NextResponse } from "next/server";

const ADMIN_ROLES = ["ADMIN", "SUPER_ADMIN", "STAFF"];

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

    return NextResponse.next();
  },
  {
    callbacks: {
      authorized: ({ token, req }) => {
        const { pathname } = req.nextUrl;
        if (
          pathname.startsWith("/dealer") ||
          pathname.startsWith("/admin") ||
          pathname.startsWith("/vendor")
        ) {
          return !!token;
        }
        return true;
      },
    },
  }
);

export const config = {
  matcher: ["/dealer/:path*", "/admin/:path*", "/vendor/:path*"],
};
