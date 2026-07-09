import type { MetadataRoute } from "next";
import { prisma } from "@/lib/prisma";

// Always the production domain — this file must never emit localhost URLs
// for crawlers, regardless of local dev env overrides.
const APP_URL = "https://motoxplus.com";

export const revalidate = 3600; // rebuild sitemap every hour

export default async function sitemap(): Promise<MetadataRoute.Sitemap> {
  // Static pages
  const staticRoutes: MetadataRoute.Sitemap = [
    { url: APP_URL, lastModified: new Date(), changeFrequency: "weekly", priority: 1 },
    { url: `${APP_URL}/about`, lastModified: new Date(), changeFrequency: "monthly", priority: 0.8 },
    { url: `${APP_URL}/products`, lastModified: new Date(), changeFrequency: "daily", priority: 0.9 },
    { url: `${APP_URL}/contact`, lastModified: new Date(), changeFrequency: "monthly", priority: 0.7 },
    { url: `${APP_URL}/become-dealer`, lastModified: new Date(), changeFrequency: "monthly", priority: 0.7 },
    { url: `${APP_URL}/become-vendor`, lastModified: new Date(), changeFrequency: "monthly", priority: 0.6 },
    { url: `${APP_URL}/privacy`, lastModified: new Date(), changeFrequency: "yearly", priority: 0.3 },
    { url: `${APP_URL}/terms`, lastModified: new Date(), changeFrequency: "yearly", priority: 0.3 },
  ];

  // Dynamic product pages
  let productRoutes: MetadataRoute.Sitemap = [];
  try {
    const products = await prisma.product.findMany({
      where: { isActive: true },
      select: { id: true, updatedAt: true },
      orderBy: { updatedAt: "desc" },
    });

    productRoutes = products.map((p) => ({
      url: `${APP_URL}/products/${p.id}`,
      lastModified: p.updatedAt,
      changeFrequency: "weekly" as const,
      priority: 0.8,
    }));
  } catch {
    // DB unavailable during static build — return only static routes
  }

  return [...staticRoutes, ...productRoutes];
}
