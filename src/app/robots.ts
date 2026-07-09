import type { MetadataRoute } from "next";

// Always the production domain — this file must never emit localhost URLs
// for crawlers, regardless of local dev env overrides.
const APP_URL = "https://motoxplus.com";

export default function robots(): MetadataRoute.Robots {
  return {
    rules: [
      {
        userAgent: "*",
        allow: ["/", "/products", "/about", "/contact", "/become-dealer", "/become-vendor"],
        disallow: [
          "/admin/",
          "/dealer/",
          "/vendor/",
          "/api/",
          "/login",
          "/register",
          "/forgot-password",
          "/reset-password",
          "/verify-email",
          "/verify-mobile",
        ],
      },
    ],
    sitemap: `${APP_URL}/sitemap.xml`,
    host: APP_URL,
  };
}
