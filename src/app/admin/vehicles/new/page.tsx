import Link from "next/link";
import { ArrowLeft } from "lucide-react";
import { prisma } from "@/lib/prisma";
import { VehicleForm } from "@/components/admin/vehicles/vehicle-form";

export default async function NewVehiclePage() {
  const manufacturers = await prisma.vehicleManufacturer.findMany({
    where: { isActive: true },
    orderBy: [{ sortOrder: "asc" }, { name: "asc" }],
    select: { id: true, name: true },
  });

  return (
    <div className="max-w-3xl">
      <div className="mb-8">
        <Link href="/admin/vehicles" className="text-[var(--text-muted)] hover:text-red-500 text-xs uppercase tracking-widest font-semibold flex items-center gap-1.5 mb-3">
          <ArrowLeft size={12} /> Back to Vehicles
        </Link>
        <h1 className="text-3xl font-black text-[var(--text-primary)] tracking-tight">Add Vehicle</h1>
        <p className="text-[var(--text-muted)] mt-1">Create a new model. Generations, variants, colors and more can be added after saving.</p>
      </div>
      <VehicleForm manufacturers={manufacturers} />
    </div>
  );
}
