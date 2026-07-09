"use client";

import Link from "next/link";
import Image from "next/image";
import { TiltCard } from "@/components/3d/tilt-card";
import { VehicleImage } from "@/components/vehicles/vehicle-image";

export interface VehicleCardData {
  slug: string;
  name: string;
  engineCc: number | null;
  yearFrom: number | null;
  yearTo: number | null;
  heroImage: string | null;
  manufacturer: { name: string; logo: string | null };
}

export function VehicleCard({ vehicle, categorySlug }: { vehicle: VehicleCardData; categorySlug: string }) {
  const years =
    vehicle.yearFrom && vehicle.yearTo
      ? `${vehicle.yearFrom}–${vehicle.yearTo}`
      : vehicle.yearFrom
        ? `${vehicle.yearFrom}–present`
        : null;

  return (
    <TiltCard intensity={6}>
      <Link
        href={`/vehicles/${categorySlug}/${vehicle.slug}`}
        className="group glass border border-[var(--border-color)] hover:border-red-900/40 rounded-2xl overflow-hidden transition-all duration-300 block"
      >
        <div className="relative h-44 bg-[var(--bg-secondary)] flex items-center justify-center overflow-hidden">
          <VehicleImage
            src={vehicle.heroImage}
            alt={vehicle.name}
            logId={`${categorySlug}/${vehicle.slug}`}
            sizes="(max-width: 768px) 100vw, (max-width: 1200px) 50vw, 25vw"
            className="p-3 group-hover:scale-105"
          />
          {vehicle.manufacturer.logo && (
            <div className="absolute top-3 left-3 bg-white/90 rounded-lg px-2 py-1">
              <Image src={vehicle.manufacturer.logo} alt={vehicle.manufacturer.name} width={48} height={16} className="object-contain h-4 w-auto" unoptimized />
            </div>
          )}
        </div>
        <div className="p-4">
          <div className="text-[var(--text-muted)] text-[10px] uppercase tracking-widest mb-1 font-mono opacity-70">
            {vehicle.manufacturer.name}
          </div>
          <h3 className="text-[var(--text-primary)] font-bold text-base mb-2 group-hover:text-red-600 transition-colors">
            {vehicle.name}
          </h3>
          <div className="flex items-center gap-3 text-xs text-[var(--text-muted)]">
            {vehicle.engineCc && <span>{vehicle.engineCc}cc</span>}
            {years && <span>{years}</span>}
          </div>
        </div>
      </Link>
    </TiltCard>
  );
}
