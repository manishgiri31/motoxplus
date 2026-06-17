import { withAuth } from "next-auth/middleware";
import { NextResponse } from "next/server";

export default withAuth(
  function middleware(req) {
    const { pathname } = req.nextUrl;
    const token = req.nextauth.token;

    // Redirect dealers away from admin
    if (pathname.startsWith("/admin") && token?.role === "DEALER") {
      return NextResponse.redirect(new URL("/dealer/dashboard", req.url));
    }

    // Redirect admins away from dealer portal
    if (
      pathname.startsWith("/dealer") &&
      (token?.role === "ADMIN" || token?.role === "SUPER_ADMIN")
    ) {
      return NextResponse.redirect(new URL("/admin/dashboard", req.url));
    }

    return NextResponse.next();
  },
  {
    callbacks: {
      authorized: ({ token, req }) => {
        const { pathname } = req.nextUrl;

        // Protect dealer and admin routes
        if (pathname.startsWith("/dealer") || pathname.startsWith("/admin")) {
          return !!token;
        }

        return true;
      },
    },
  }
);

export const config = {
  matcher: ["/dealer/:path*", "/admin/:path*"],
};
