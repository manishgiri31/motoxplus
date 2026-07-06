import type { Metadata } from "next";
import Link from "next/link";
import { Bike, Zap, Truck, ArrowRight } from "lucide-react";
import { prisma } from "@/lib/prisma";
import { VEHICLE_CATEGORIES } from "@/lib/vehicle-categories";
import { TiltCard } from "@/components/3d/tilt-card";

export const metadata: Metadata = {
  title: "Select Your Vehicle",
  description: "Choose your vehicle to instantly find compatible MotoXPlus spare parts.",
};

const CATEGORY_ICON = {
  MOTORCYCLE: Bike,
  SCOOTER: Bike,
  ELECTRIC: Zap,
  COMMERCIAL: Truck,
} as const;

export default async function VehiclesPage() {
  const counts = await prisma.vehicle.groupBy({
    by: ["category"],
    where: { isActive: true },
    _count: { _all: true },
  });
  const countByCategory = Object.fromEntries(counts.map((c) => [c.category, c._count._all]));

  return (
    <div className="min-h-screen bg-[var(--bg-primary)]">
      <section className="py-16 px-4 md:px-8 border-b border-[var(--border-color)]">
        <div className="max-w-7xl mx-auto">
          <div className="flex items-center gap-3 mb-4">
            <div className="w-8 h-px bg-red-600" />
            <span className="text-red-500 text-xs font-semibold uppercase tracking-widest">Vehicle Explorer</span>
          </div>
          <h1 className="text-4xl md:text-5xl font-black text-[var(--text-primary)] tracking-tight">
            Select Your <span className="text-gradient-red">Vehicle.</span>
          </h1>
          <p className="text-[var(--text-muted)] mt-4 max-w-xl">
            Choose your vehicle first — we&apos;ll show only the parts that fit. No more guessing compatibility.
          </p>
        </div>
      </section>

      <section className="py-16 px-4 md:px-8">
        <div className="max-w-7xl mx-auto grid grid-cols-1 sm:grid-cols-2 gap-6">
          {VEHICLE_CATEGORIES.map((cat) => {
            const Icon = CATEGORY_ICON[cat.value];
            const count = countByCategory[cat.value] ?? 0;
            return (
              <TiltCard key={cat.slug} intensity={6}>
                <Link
                  href={`/vehicles/${cat.slug}`}
                  className="group relative overflow-hidden rounded-3xl block glass border border-[var(--border-color)] hover:border-red-900/40 transition-all duration-300 p-10 min-h-[240px] flex flex-col justify-between"
                >
                  <div className="absolute inset-0 bg-gradient-to-br from-red-600/0 to-red-600/0 group-hover:from-red-600/10 group-hover:to-transparent transition-all duration-500" />
                  <div className="relative z-10 flex items-center justify-between">
                    <div className="w-16 h-16 rounded-2xl flex items-center justify-center bg-red-600/10 border border-red-600/20 group-hover:bg-red-600/20 transition-colors">
                      <Icon size={30} className="text-red-500" />
                    </div>
                    <ArrowRight size={22} className="text-[var(--text-muted)] group-hover:text-red-500 group-hover:translate-x-1 transition-all" />
                  </div>
                  <div className="relative z-10">
                    <h2 className="text-3xl font-black text-[var(--text-primary)] tracking-tight mb-2">
                      {cat.label}
                    </h2>
                    <p className="text-[var(--text-muted)] text-sm mb-4">{cat.tagline}</p>
                    {count > 0 ? (
                      <span className="inline-flex items-center gap-2 rounded-full px-3 py-1 bg-red-600/10 border border-red-600/20 text-red-500 text-xs font-bold">
                        {count} model{count === 1 ? "" : "s"}
                      </span>
                    ) : (
                      <span className="inline-flex items-center gap-2 rounded-full px-3 py-1 bg-[var(--bg-secondary)] border border-[var(--border-color)] text-[var(--text-muted)] text-xs font-semibold">
                        Coming soon
                      </span>
                    )}
                  </div>
                </Link>
              </TiltCard>
            );
          })}
        </div>
      </section>
    </div>
  );
}
