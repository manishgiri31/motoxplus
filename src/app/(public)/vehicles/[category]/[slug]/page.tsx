import type { Metadata } from "next";
import { notFound } from "next/navigation";
import { prisma } from "@/lib/prisma";
import { categoryBySlug } from "@/lib/vehicle-categories";
import { getVehicleDetail } from "@/lib/catalog/queries";
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

  const data = await getVehicleDetail({
    categorySlug: params.category,
    vehicleSlug: params.slug,
    variantSlug: searchParams.variant ?? null,
    generationId: searchParams.generation ?? null,
    year: searchParams.year ? Number(searchParams.year) || null : null,
    sectionSlug: searchParams.section ?? null,
  });
  if (!data) notFound();

  const {
    vehicle,
    sections,
    compatibleProducts,
    compatibleCount,
    reviews,
    accessories,
    recommendations,
    faqs,
    relatedVehicles,
    selection,
  } = data;

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
        selection={selection}
      />
    </>
  );
}
