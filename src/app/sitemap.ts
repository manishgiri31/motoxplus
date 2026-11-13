import type { MetadataRoute } from "next";
import { prisma } from "@/lib/prisma";
import { VEHICLE_CATEGORIES } from "@/lib/vehicle-categories";

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
    { url: `${APP_URL}/cancellation-policy`, lastModified: new Date(), changeFrequency: "yearly", priority: 0.3 },
    { url: `${APP_URL}/vehicles`, lastModified: new Date(), changeFrequency: "weekly", priority: 0.8 },
    ...VEHICLE_CATEGORIES.map((c) => ({
      url: `${APP_URL}/vehicles/${c.slug}`,
      lastModified: new Date(),
      changeFrequency: "weekly" as const,
      priority: 0.7,
    })),
  ];

  // Dynamic product pages
  let productRoutes: MetadataRoute.Sitemap = [];
  try {
    const products = await prisma.product.findMany({
      where: { isActive: true },
      select: { slug: true, updatedAt: true },
      orderBy: { updatedAt: "desc" },
    });

    // The slug URL is the canonical one; /products/<id> only 308-redirects to it.
    productRoutes = products.map((p) => ({
      url: `${APP_URL}/products/${p.slug}`,
      lastModified: p.updatedAt,
      changeFrequency: "weekly" as const,
      priority: 0.8,
    }));
  } catch {
    // DB unavailable during static build — return only static routes
  }

  // Vehicle pages (/vehicles/<category>/<slug>): each lists the parts that fit one model.
  let vehicleRoutes: MetadataRoute.Sitemap = [];
  try {
    const vehicles = await prisma.vehicle.findMany({
      where: { isActive: true },
      select: { slug: true, category: true, updatedAt: true },
    });
    vehicleRoutes = vehicles.flatMap((v) => {
      const cat = VEHICLE_CATEGORIES.find((c) => c.value === v.category);
      return cat
        ? [{ url: `${APP_URL}/vehicles/${cat.slug}/${v.slug}`, lastModified: v.updatedAt, changeFrequency: "weekly" as const, priority: 0.7 }]
        : [];
    });
  } catch {
    // Same as products: static routes only when the DB is unavailable.
  }

  return [...staticRoutes, ...productRoutes, ...vehicleRoutes];
}
