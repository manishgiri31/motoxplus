import { notFound } from "next/navigation";
import Link from "next/link";
import { ArrowLeft } from "lucide-react";
import { prisma } from "@/lib/prisma";
import { VehicleForm } from "@/components/admin/vehicles/vehicle-form";
import { VehicleCatalogManagers } from "@/components/admin/vehicles/vehicle-catalog-managers";
import { DiagramManager } from "@/components/admin/vehicles/diagram-manager";

export default async function EditVehiclePage(props: { params: Promise<{ id: string }> }) {
  const params = await props.params;
  const [vehicle, manufacturers, sections] = await Promise.all([
    prisma.vehicle.findUnique({ where: { id: params.id } }),
    prisma.vehicleManufacturer.findMany({
      where: { isActive: true },
      orderBy: [{ sortOrder: "asc" }, { name: "asc" }],
      select: { id: true, name: true },
    }),
    prisma.vehiclePartSection.findMany({
      where: { isActive: true },
      orderBy: { sortOrder: "asc" },
      select: { id: true, name: true },
    }),
  ]);

  if (!vehicle) notFound();

  return (
    <div className="max-w-4xl space-y-8">
      <div>
        <Link href="/admin/vehicles" className="text-[var(--text-muted)] hover:text-red-500 text-xs uppercase tracking-widest font-semibold flex items-center gap-1.5 mb-3">
          <ArrowLeft size={12} /> Back to Vehicles
        </Link>
        <h1 className="text-3xl font-black text-[var(--text-primary)] tracking-tight">{vehicle.name}</h1>
        <p className="text-[var(--text-muted)] mt-1">
          Manage this model&apos;s core details, generations, variants, colors, media and fitment data.
        </p>
      </div>

      <VehicleForm manufacturers={manufacturers} vehicle={JSON.parse(JSON.stringify(vehicle))} />

      <VehicleCatalogManagers vehicleId={vehicle.id} manufacturerId={vehicle.manufacturerId} />

      <DiagramManager vehicleId={vehicle.id} sections={sections} />
    </div>
  );
}
