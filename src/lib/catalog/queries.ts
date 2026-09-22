import { unstable_cache } from "next/cache";
import { prisma } from "@/lib/prisma";
import { buildSearchWhere } from "@/lib/product-search";
import { getCompatibleProductIds, getCompatibleProducts, getCompatibilityCount, getVehicleSections, type CompatibilityFilter } from "@/lib/vehicle/compatibility";
import { categoryBySlug } from "@/lib/vehicle-categories";

/**
 * Cached reads for the public storefront (catalog list, product detail,
 * vehicle browsing). Every function here is a pure DB read with no
 * session/role dependency — price and MRP are the same Product columns for
 * every visitor (see displayChannel() in lib/pricing/channel.ts), role only
 * decides which of the two gets *rendered*, and that branch always runs
 * fresh in the page component, outside of these caches. Never add
 * getServerSession/cookies()/headers() inside a function wrapped here.
 *
 * Invalidated by revalidateTag("products" | "categories" | "vehicles" | "reviews")
 * from the admin/dealer/vendor mutation routes that change this data.
 */
const CATALOG_REVALIDATE = 300;

// ── Product catalog list (/products) ────────────────────────────────────

export interface CatalogListParams {
  category?: string;
  search?: string;
  page: number;
  vehicle?: string;
  variant?: string;
  section?: string;
}

async function fetchCatalogList(params: CatalogListParams) {
  const pageSize = 12;
  const { page, search, category, vehicle, variant, section } = params;

  const searchWhere = search ? await buildSearchWhere(search, true) : {};

  let vehicleWhere = {};
  let vehicleName: string | undefined;
  if (vehicle) {
    const v = await prisma.vehicle.findUnique({ where: { slug: vehicle } });
    if (v) {
      vehicleName = v.name;
      const [selectedVariant, selectedSection] = await Promise.all([
        variant
          ? prisma.vehicleVariant.findFirst({ where: { vehicleId: v.id, slug: variant } })
          : Promise.resolve(null),
        section
          ? prisma.vehiclePartSection.findFirst({ where: { slug: section } })
          : Promise.resolve(null),
      ]);
      const filter: CompatibilityFilter = {
        vehicleId: v.id,
        variantId: selectedVariant?.id ?? null,
        generationId: selectedVariant?.generationId ?? null,
        sectionId: selectedSection?.id ?? null,
      };
      const productIds = await getCompatibleProductIds(filter);
      vehicleWhere = { id: { in: productIds } };
    }
  }

  const baseWhere = {
    isActive: true,
    ...(category && { category: { slug: category } }),
    ...searchWhere,
    ...vehicleWhere,
  };

  const [products, categories, totalProducts] = await Promise.all([
    (prisma.product as any).findMany({
      where: baseWhere,
      include: {
        category: true,
        productImages: { orderBy: [{ isPrimary: "desc" }, { sortOrder: "asc" }], take: 1 },
        variants: {
          where: { isActive: true, color: { not: null } },
          select: { color: true },
          take: 6,
        },
      },
      skip: (page - 1) * pageSize,
      take: pageSize,
      orderBy: [{ source: "asc" }, { stockStatus: "asc" }, { createdAt: "desc" }],
    }),
    prisma.category.findMany({
      where: { isActive: true },
      orderBy: { sortOrder: "asc" },
    }),
    prisma.product.count({ where: baseWhere }),
  ]);

  return { products, categories, totalProducts, vehicleName, pageSize };
}

export const getCatalogList = unstable_cache(fetchCatalogList, ["catalog-list-v1"], {
  revalidate: CATALOG_REVALIDATE,
  // "vehicles" too: the ?vehicle=/?variant=/?section= filter path resolves
  // variant/section data fresh on a cache miss, so a stale hit could keep
  // serving a product-id list computed against an edited variant/section.
  tags: ["products", "categories", "vehicles"],
});

// ── Product detail (/products/[slug]) ───────────────────────────────────

export interface ProductBySlugResult {
  product: any | null;
  legacySlug: string | null;
}

async function fetchProductBySlugOrLegacyId(value: string): Promise<ProductBySlugResult> {
  const bySlug = await (prisma.product as any).findUnique({
    where: { slug: value, isActive: true },
    include: {
      category: true,
      productImages: { orderBy: [{ isPrimary: "desc" }, { sortOrder: "asc" }] },
      variants: {
        where: { isActive: true },
        orderBy: [{ sortOrder: "asc" }, { createdAt: "asc" }],
        include: { images: { orderBy: [{ isPrimary: "desc" }, { sortOrder: "asc" }] } },
      },
    },
  });
  if (bySlug) return { product: bySlug, legacySlug: null };

  const byId = await prisma.product.findUnique({ where: { id: value }, select: { slug: true } });
  return { product: null, legacySlug: byId?.slug ?? null };
}

export const getProductBySlugOrLegacyId = unstable_cache(
  fetchProductBySlugOrLegacyId,
  ["product-detail-v1"],
  { revalidate: CATALOG_REVALIDATE, tags: ["products"] }
);

async function fetchRelatedByCompatibleIds(compatibleIds: string[]) {
  return (prisma.product as any).findMany({
    where: { id: { in: compatibleIds }, isActive: true },
    include: {
      category: true,
      productImages: { orderBy: [{ isPrimary: "desc" }, { sortOrder: "asc" }] },
    },
    take: 8,
    orderBy: [{ stockStatus: "asc" }, { createdAt: "desc" }],
  });
}

export const getRelatedByCompatibleIds = unstable_cache(
  fetchRelatedByCompatibleIds,
  ["related-by-compat-v1"],
  { revalidate: CATALOG_REVALIDATE, tags: ["products"] }
);

async function fetchRelatedByCategory(categoryId: string, excludeProductId: string) {
  return (prisma.product as any).findMany({
    where: { categoryId, id: { not: excludeProductId }, isActive: true },
    take: 4,
    include: {
      category: true,
      productImages: { orderBy: [{ isPrimary: "desc" }, { sortOrder: "asc" }] },
    },
  });
}

export const getRelatedByCategory = unstable_cache(
  fetchRelatedByCategory,
  ["related-by-category-v1"],
  { revalidate: CATALOG_REVALIDATE, tags: ["products"] }
);

async function fetchReviewStats(productId: string) {
  return prisma.review.aggregate({
    where: { productId, isApproved: true },
    _avg: { rating: true },
    _count: { rating: true },
  });
}

export const getReviewStats = unstable_cache(fetchReviewStats, ["review-stats-v1"], {
  revalidate: CATALOG_REVALIDATE,
  tags: ["products", "reviews"],
});

// ── Vehicle browsing (/vehicles/[category], /vehicles/[category]/[slug]) ─

async function fetchVehiclesByCategory(categoryValue: string) {
  return prisma.vehicle.findMany({
    where: { category: categoryValue as any, isActive: true },
    include: { manufacturer: { select: { name: true, logo: true } } },
    orderBy: [{ sortOrder: "asc" }, { name: "asc" }],
  });
}

export const getVehiclesByCategory = unstable_cache(
  fetchVehiclesByCategory,
  ["vehicles-by-category-v1"],
  { revalidate: CATALOG_REVALIDATE, tags: ["vehicles"] }
);

export interface VehicleDetailFetchParams {
  categorySlug: string;
  vehicleSlug: string;
  variantSlug?: string | null;
  generationId?: string | null;
  year?: number | null;
  sectionSlug?: string | null;
}

async function fetchVehicleDetail(params: VehicleDetailFetchParams) {
  const cat = categoryBySlug(params.categorySlug);
  if (!cat) return null;

  const vehicle = await prisma.vehicle.findUnique({
    where: { slug: params.vehicleSlug, isActive: true },
    include: {
      manufacturer: true,
      colors: { orderBy: { sortOrder: "asc" }, include: { oemColor: true } },
      gallery: { orderBy: { sortOrder: "asc" } },
      generations: {
        where: { isActive: true },
        orderBy: { sortOrder: "asc" },
        include: { variants: { where: { isActive: true }, orderBy: { sortOrder: "asc" } } },
      },
      variants: {
        where: { isActive: true, generationId: null },
        orderBy: { sortOrder: "asc" },
      },
      diagrams: {
        where: { isActive: true },
        orderBy: { sortOrder: "asc" },
        include: { hotspots: { orderBy: { sortOrder: "asc" } } },
      },
      model3d: { orderBy: { sortOrder: "asc" } },
      spins: { orderBy: { sortOrder: "asc" } },
    },
  });

  if (!vehicle || vehicle.category !== cat.value) return null;

  const allVariants = [...vehicle.generations.flatMap((g) => g.variants), ...vehicle.variants];
  const selectedVariant = params.variantSlug
    ? allVariants.find((v) => v.slug === params.variantSlug) ?? null
    : null;
  const selectedGeneration = params.generationId
    ? vehicle.generations.find((g) => g.id === params.generationId) ?? null
    : selectedVariant?.generationId
      ? vehicle.generations.find((g) => g.id === selectedVariant.generationId) ?? null
      : null;
  const selectedYear = params.year ?? null;

  const sections = await getVehicleSections(vehicle.id);
  const selectedSection = params.sectionSlug
    ? sections.find((s) => s.slug === params.sectionSlug) ?? null
    : null;

  const filter: CompatibilityFilter = {
    vehicleId: vehicle.id,
    generationId: selectedGeneration?.id ?? null,
    variantId: selectedVariant?.id ?? null,
    year: selectedYear,
    sectionId: selectedSection?.id ?? null,
  };

  const [compatibleProducts, compatibleCount, reviews, accessories, recommendations, faqs, relatedVehicles] =
    await Promise.all([
      getCompatibleProducts(filter, { take: 8 }),
      getCompatibilityCount(filter),
      prisma.review.findMany({
        where: { vehicleId: vehicle.id, isApproved: true },
        orderBy: { createdAt: "desc" },
        include: { user: { select: { name: true } } },
      }),
      prisma.vehicleAccessory.findMany({
        where: { vehicleId: vehicle.id },
        orderBy: { sortOrder: "asc" },
        include: {
          product: {
            include: { category: true, productImages: { orderBy: [{ isPrimary: "desc" }, { sortOrder: "asc" }], take: 1 } },
          },
        },
      }),
      prisma.vehicleProductRecommendation.findMany({
        where: { vehicleId: vehicle.id },
        orderBy: { priority: "asc" },
        include: {
          product: {
            include: { category: true, productImages: { orderBy: [{ isPrimary: "desc" }, { sortOrder: "asc" }], take: 1 } },
          },
        },
      }),
      prisma.vehicleFAQ.findMany({
        where: { vehicleId: vehicle.id, isActive: true },
        orderBy: { sortOrder: "asc" },
      }),
      prisma.vehicle.findMany({
        where: {
          id: { not: vehicle.id },
          isActive: true,
          OR: [{ manufacturerId: vehicle.manufacturerId }, { category: vehicle.category }],
        },
        include: { manufacturer: { select: { name: true, logo: true } } },
        orderBy: { sortOrder: "asc" },
        take: 8,
      }),
    ]);

  return {
    vehicle,
    sections,
    compatibleProducts,
    compatibleCount,
    reviews,
    accessories,
    recommendations,
    faqs,
    relatedVehicles,
    selection: {
      generationId: selectedGeneration?.id ?? null,
      variantSlug: selectedVariant?.slug ?? null,
      year: selectedYear,
      sectionSlug: selectedSection?.slug ?? null,
    },
  };
}

export const getVehicleDetail = unstable_cache(fetchVehicleDetail, ["vehicle-detail-v1"], {
  revalidate: CATALOG_REVALIDATE,
  tags: ["vehicles", "products", "reviews"],
});

// ── Brand/vehicle/category landing (/[brand]/[vehicle]/[category]) ──────

export interface BrandVehicleCategoryParams {
  brand: string;
  vehicle: string;
  category: string;
}

async function fetchBrandVehicleCategory(params: BrandVehicleCategoryParams) {
  const manufacturer = await prisma.vehicleManufacturer.findUnique({ where: { slug: params.brand } });
  if (!manufacturer) return null;

  const vehicle = await prisma.vehicle.findUnique({ where: { slug: params.vehicle } });
  if (!vehicle || vehicle.manufacturerId !== manufacturer.id || !vehicle.isActive) return null;

  const category = await prisma.category.findUnique({ where: { slug: params.category } });
  if (!category || !category.isActive) return null;

  const allCompatible = await getCompatibleProducts({ vehicleId: vehicle.id }, { take: 60 });
  const products = allCompatible.filter((p) => p.categoryId === category.id);
  if (products.length === 0) return null;

  const vehicleCategory = categoryBySlug(
    vehicle.category === "MOTORCYCLE" ? "motorcycle" : vehicle.category === "SCOOTER" ? "scooter" : vehicle.category === "ELECTRIC" ? "electric" : "commercial"
  );

  return { manufacturer, vehicle, category, products, vehicleCategory };
}

export const getBrandVehicleCategoryData = unstable_cache(
  fetchBrandVehicleCategory,
  ["brand-vehicle-category-v1"],
  { revalidate: CATALOG_REVALIDATE, tags: ["vehicles", "products", "categories"] }
);
