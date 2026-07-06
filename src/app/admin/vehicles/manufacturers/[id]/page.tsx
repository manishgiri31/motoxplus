import { notFound } from "next/navigation";
import Link from "next/link";
import { ArrowLeft } from "lucide-react";
import { prisma } from "@/lib/prisma";
import { OemColorManager } from "@/components/admin/vehicles/oem-color-manager";

export default async function ManufacturerDetailPage({ params }: { params: { id: string } }) {
  const manufacturer = await prisma.vehicleManufacturer.findUnique({ where: { id: params.id } });
  if (!manufacturer) notFound();

  return (
    <div className="max-w-4xl">
      <div className="mb-8">
        <Link href="/admin/vehicles/manufacturers" className="text-[var(--text-muted)] hover:text-red-500 text-xs uppercase tracking-widest font-semibold flex items-center gap-1.5 mb-3">
          <ArrowLeft size={12} /> Back to Manufacturers
        </Link>
        <h1 className="text-3xl font-black text-[var(--text-primary)] tracking-tight">{manufacturer.name}</h1>
        <p className="text-[var(--text-muted)] mt-1">OEM color library — paint codes and hex swatches used by this manufacturer&apos;s models.</p>
      </div>

      <OemColorManager manufacturerId={manufacturer.id} />
    </div>
  );
}
