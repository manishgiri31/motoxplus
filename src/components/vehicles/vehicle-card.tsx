import Link from "next/link";
import Image from "next/image";
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
    <Link
      href={`/vehicles/${categorySlug}/${vehicle.slug}`}
      className="group bg-[var(--card)] border border-[var(--line)] hover:border-[var(--red)]/40 transition-colors block"
    >
      <div className="relative h-44 bg-[var(--paper)] border-b border-[var(--line)] flex items-center justify-center overflow-hidden">
        <VehicleImage
          src={vehicle.heroImage}
          alt={vehicle.name}
          logId={`${categorySlug}/${vehicle.slug}`}
          sizes="(max-width: 768px) 100vw, (max-width: 1200px) 50vw, 25vw"
          className="p-3 group-hover:scale-[1.02] transition-transform duration-300"
        />
        {vehicle.manufacturer.logo && (
          <div className="absolute top-3 left-3 bg-white/95 border border-[var(--line)] px-2 py-1">
            <Image src={vehicle.manufacturer.logo} alt={vehicle.manufacturer.name} width={48} height={16} className="object-contain h-4 w-auto" unoptimized />
          </div>
        )}
      </div>
      <div className="p-4">
        <div className="font-mono text-[var(--muted)] text-[10px] uppercase tracking-widest mb-1 opacity-80">
          {vehicle.manufacturer.name}
        </div>
        <h3 className="text-[var(--ink)] font-bold text-base mb-2 group-hover:text-[var(--red)] transition-colors">
          {vehicle.name}
        </h3>
        <div className="flex items-center gap-3 text-xs text-[var(--muted)]">
          {vehicle.engineCc && <span>{vehicle.engineCc}cc</span>}
          {years && <span>{years}</span>}
        </div>
      </div>
    </Link>
  );
}
