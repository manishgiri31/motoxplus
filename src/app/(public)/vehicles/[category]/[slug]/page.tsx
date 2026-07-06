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

export async function generateMetadata({
  params,
}: {
  params: { category: string; slug: string };
}): Promise<Metadata> {
  const vehicle = await prisma.vehicle.findUnique({ where: { slug: params.slug } });
  if (!vehicle) return { title: "Vehicle Not Found" };
  return {
    title: vehicle.name,
    description: `Specs, colors, gallery and compatible MotoXPlus spare parts for the ${vehicle.name}.`,
  };
}

export default async function VehicleDetailPage({
  params,
  searchParams,
}: {
  params: { category: string; slug: string };
  searchParams: { variant?: string; generation?: string; year?: string; section?: string };
}) {
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

  const [compatibleProducts, compatibleCount] = await Promise.all([
    getCompatibleProducts(filter, { take: 8 }),
    getCompatibilityCount(filter),
  ]);

  return (
    <VehicleDetailClient
      vehicle={JSON.parse(JSON.stringify(vehicle))}
      categorySlug={cat.slug}
      sections={JSON.parse(JSON.stringify(sections))}
      compatibleProducts={JSON.parse(JSON.stringify(compatibleProducts))}
      compatibleCount={compatibleCount}
      selection={{
        generationId: selectedGeneration?.id ?? null,
        variantSlug: selectedVariant?.slug ?? null,
        year: selectedYear,
        sectionSlug: selectedSection?.slug ?? null,
      }}
    />
  );
}
