import type { Metadata } from "next";
import Link from "next/link";
import { notFound } from "next/navigation";
import { prisma } from "@/lib/prisma";
import { categoryBySlug } from "@/lib/vehicle-categories";
import { VehicleGrid } from "@/components/vehicles/vehicle-grid";

export async function generateMetadata({
  params,
}: {
  params: { category: string };
}): Promise<Metadata> {
  const cat = categoryBySlug(params.category);
  if (!cat) return { title: "Not Found" };
  return { title: cat.label, description: `Browse all supported ${cat.label.toLowerCase()} and find compatible parts.` };
}

export default async function VehicleCategoryPage({ params }: { params: { category: string } }) {
  const cat = categoryBySlug(params.category);
  if (!cat) notFound();

  const vehicles = await prisma.vehicle.findMany({
    where: { category: cat.value, isActive: true },
    include: { manufacturer: { select: { name: true, logo: true } } },
    orderBy: [{ sortOrder: "asc" }, { name: "asc" }],
  });

  return (
    <div className="min-h-screen bg-[var(--bg-primary)]">
      <section className="py-16 px-4 md:px-8 border-b border-[var(--border-color)]">
        <div className="max-w-7xl mx-auto">
          <Link href="/vehicles" className="text-[var(--text-muted)] hover:text-red-500 text-xs uppercase tracking-widest font-semibold">
            ← All Vehicles
          </Link>
          <h1 className="text-4xl md:text-5xl font-black text-[var(--text-primary)] tracking-tight mt-4">
            {cat.label.slice(0, -1)}<span className="text-gradient-red">s.</span>
          </h1>
          <p className="text-[var(--text-muted)] mt-4 max-w-xl">
            {vehicles.length} model{vehicles.length === 1 ? "" : "s"} supported. Select yours to see compatible parts.
          </p>
        </div>
      </section>

      <section className="py-16 px-4 md:px-8">
        <div className="max-w-7xl mx-auto">
          {vehicles.length === 0 ? (
            <div className="text-center py-24">
              <p className="text-[var(--text-muted)]">No {cat.label.toLowerCase()} added yet. Check back soon.</p>
            </div>
          ) : (
            <VehicleGrid vehicles={JSON.parse(JSON.stringify(vehicles))} categorySlug={cat.slug} />
          )}
        </div>
      </section>
    </div>
  );
}
