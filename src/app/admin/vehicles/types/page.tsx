import Link from "next/link";
import { ArrowLeft } from "lucide-react";
import { VehicleTypeImageUploader } from "@/components/admin/vehicle-type-image-uploader";

export default function VehicleTypesPage() {
  return (
    <div className="max-w-3xl">
      <div className="mb-8">
        <Link href="/admin/vehicles" className="text-[var(--text-muted)] hover:text-red-500 text-xs uppercase tracking-widest font-semibold flex items-center gap-1.5 mb-3">
          <ArrowLeft size={12} /> Back to Vehicles
        </Link>
        <h1 className="text-3xl font-black text-[var(--text-primary)] tracking-tight">Vehicle Types</h1>
        <p className="text-[var(--text-muted)] mt-1">
          One card image per category — shown on the public /vehicles landing page.
        </p>
      </div>

      <VehicleTypeImageUploader />
    </div>
  );
}
