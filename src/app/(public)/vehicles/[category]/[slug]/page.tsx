import type { Metadata } from "next";
import { notFound } from "next/navigation";
import { prisma } from "@/lib/prisma";
import { categoryBySlug } from "@/lib/vehicle-categories";
import {
  getCompatibleProducts,
  getCompatibilityCount,
  getVehicleSections,
  type CompatibilityFilter,
} from "@/lib/vehicle/compatibility";
import { VehicleDetailClient } from "@/components/vehicles/vehicle-detail-client";
import { JsonLd } from "@/components/seo/json-ld";
import { absoluteUrl, buildMetadata } from "@/lib/seo";

export async function generateMetadata(
  props: {
    params: Promise<{ category: string; slug: string }>;
  }
): Promise<Metadata> {
  const params = await props.params;
  const cat = categoryBySlug(params.category);
  const vehicle = await prisma.vehicle.findUnique({
    where: { slug: params.slug },
    include: { manufacturer: true },
  });
  if (!vehicle || !cat) return { title: "Vehicle Not Found" };

  return buildMetadata({
    title: `${vehicle.name} Spare Parts | ${vehicle.manufacturer.name}`,
    description: `Genuine-fit spare parts, specs, colors and gallery for the ${vehicle.manufacturer.name} ${vehicle.name}. Browse compatible MotoXPlus parts for this ${cat.label.toLowerCase().slice(0, -1)}.`,
    path: `/vehicles/${cat.slug}/${vehicle.slug}`,
    image: vehicle.heroImage || undefined,
  });
}

export default async function VehicleDetailPage(
  props: {
    params: Promise<{ category: string; slug: string }>;
    searchParams: Promise<{ variant?: string; generation?: string; year?: string; section?: string }>;
  }
) {
  const searchParams = await props.searchParams;
  const params = await props.params;
  const cat = categoryBySlug(params.category);
  if (!cat) notFound();

  const vehicle = await prisma.vehicle.findUnique({
    where: { slug: params.slug, isActive: true },
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

  if (!vehicle || vehicle.category !== cat.value) notFound();

  const allVariants = [...vehicle.generations.flatMap((g) => g.variants), ...vehicle.variants];
  const selectedVariant = searchParams.variant
    ? allVariants.find((v) => v.slug === searchParams.variant) ?? null
    : null;
  const selectedGeneration = searchParams.generation
    ? vehicle.generations.find((g) => g.id === searchParams.generation) ?? null
    : selectedVariant?.generationId
      ? vehicle.generations.find((g) => g.id === selectedVariant.generationId) ?? null
      : null;
  const selectedYear = searchParams.year ? Number(searchParams.year) || null : null;

  const sections = await getVehicleSections(vehicle.id);
  const selectedSection = searchParams.section
    ? sections.find((s) => s.slug === searchParams.section) ?? null
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

  return (
    <>
      <JsonLd
        data={{
          "@context": "https://schema.org",
          "@type": "BreadcrumbList",
          itemListElement: [
            { "@type": "ListItem", position: 1, name: "Home", item: absoluteUrl("/") },
            { "@type": "ListItem", position: 2, name: "Vehicles", item: absoluteUrl("/vehicles") },
            { "@type": "ListItem", position: 3, name: cat.label, item: absoluteUrl(`/vehicles/${cat.slug}`) },
            {
              "@type": "ListItem",
              position: 4,
              name: vehicle.name,
              item: absoluteUrl(`/vehicles/${cat.slug}/${vehicle.slug}`),
            },
          ],
        }}
      />
      <VehicleDetailClient
        vehicle={JSON.parse(JSON.stringify(vehicle))}
        categorySlug={cat.slug}
        sections={JSON.parse(JSON.stringify(sections))}
        compatibleProducts={JSON.parse(JSON.stringify(compatibleProducts))}
        compatibleCount={compatibleCount}
        reviews={JSON.parse(JSON.stringify(reviews))}
        accessories={JSON.parse(JSON.stringify(accessories))}
        recommendations={JSON.parse(JSON.stringify(recommendations))}
        faqs={JSON.parse(JSON.stringify(faqs))}
        relatedVehicles={JSON.parse(JSON.stringify(relatedVehicles))}
        selection={{
          generationId: selectedGeneration?.id ?? null,
          variantSlug: selectedVariant?.slug ?? null,
          year: selectedYear,
          sectionSlug: selectedSection?.slug ?? null,
        }}
      />
    </>
  );
}
