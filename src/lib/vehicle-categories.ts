import type { VehicleCategory } from "@prisma/client";

export const VEHICLE_CATEGORIES: {
  value: VehicleCategory;
  slug: string;
  label: string;
  tagline: string;
}[] = [
  { value: "MOTORCYCLE", slug: "motorcycle", label: "Motorcycles", tagline: "Commuter, sport & cruiser bikes" },
  { value: "SCOOTER", slug: "scooter", label: "Scooters", tagline: "Automatic & geared scooters" },
  { value: "ELECTRIC", slug: "electric", label: "Electric", tagline: "EV two-wheelers" },
  { value: "COMMERCIAL", slug: "commercial", label: "Commercial", tagline: "Load carriers & three-wheelers" },
];

export function categoryBySlug(slug: string) {
  return VEHICLE_CATEGORIES.find((c) => c.slug === slug.toLowerCase());
}
