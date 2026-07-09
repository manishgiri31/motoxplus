import type { Metadata } from "next";
import Link from "next/link";
import Image from "next/image";
import { Bike, Zap, Truck, ArrowUpRight } from "lucide-react";
import { prisma } from "@/lib/prisma";
import { VEHICLE_CATEGORIES } from "@/lib/vehicle-categories";

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

// Category-tinted gradient used behind the line-art placeholder when a
// category has no representative vehicle photo yet.
const CATEGORY_TINT = {
  MOTORCYCLE: "from-red-900/40 via-zinc-900 to-black",
  SCOOTER: "from-zinc-700/40 via-zinc-900 to-black",
  ELECTRIC: "from-emerald-900/40 via-zinc-900 to-black",
  COMMERCIAL: "from-amber-900/40 via-zinc-900 to-black",
} as const;

export default async function VehiclesPage() {
  const [counts, sampleVehicles] = await Promise.all([
    prisma.vehicle.groupBy({
      by: ["category"],
      where: { isActive: true },
      _count: { _all: true },
    }),
    prisma.vehicle.findMany({
      where: { isActive: true, heroImage: { not: null } },
      orderBy: [{ sortOrder: "asc" }, { name: "asc" }],
      select: { category: true, heroImage: true, name: true },
    }),
  ]);

  const countByCategory = Object.fromEntries(counts.map((c) => [c.category, c._count._all]));
  const imageByCategory: Partial<Record<string, { heroImage: string; name: string }>> = {};
  for (const v of sampleVehicles) {
    if (!imageByCategory[v.category] && v.heroImage) {
      imageByCategory[v.category] = { heroImage: v.heroImage, name: v.name };
    }
  }

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
            const sample = imageByCategory[cat.value];

            return (
              <Link
                key={cat.slug}
                href={`/vehicles/${cat.slug}`}
                className="group relative overflow-hidden rounded-3xl block h-[320px] md:h-[380px] shadow-lg hover:shadow-2xl hover:shadow-black/30 transition-shadow duration-500"
              >
                {/* Image or line-art placeholder */}
                <div className="absolute inset-0">
                  {sample ? (
                    <Image
                      src={sample.heroImage}
                      alt={`${cat.label} — ${sample.name}`}
                      fill
                      unoptimized
                      className="object-cover transition-transform duration-700 ease-out group-hover:scale-110"
                      sizes="(min-width: 768px) 50vw, 100vw"
                    />
                  ) : (
                    <div className={`absolute inset-0 bg-gradient-to-br ${CATEGORY_TINT[cat.value]}`}>
                      <Icon
                        size={220}
                        strokeWidth={0.6}
                        className="absolute -right-8 -bottom-8 text-white/[0.07] transition-transform duration-700 ease-out group-hover:scale-110 group-hover:-rotate-3"
                      />
                    </div>
                  )}
                </div>

                {/* Gradient overlay for legibility */}
                <div className="absolute inset-0 bg-gradient-to-t from-black/90 via-black/25 to-black/10" />
                <div className="absolute inset-0 bg-gradient-to-br from-red-600/0 to-red-600/0 group-hover:from-red-600/15 group-hover:to-transparent transition-all duration-500" />

                {/* Top row: icon chip + arrow */}
                <div className="relative z-10 h-full flex flex-col justify-between p-7 md:p-8">
                  <div className="flex items-center justify-between">
                    <div className="w-12 h-12 rounded-xl flex items-center justify-center bg-white/10 backdrop-blur-md border border-white/15">
                      <Icon size={22} className="text-white" />
                    </div>
                    <div className="w-11 h-11 rounded-full flex items-center justify-center bg-white/10 backdrop-blur-md border border-white/15 group-hover:bg-red-600 group-hover:border-red-600 transition-all duration-300">
                      <ArrowUpRight size={18} className="text-white group-hover:translate-x-0.5 group-hover:-translate-y-0.5 transition-transform" />
                    </div>
                  </div>

                  <div>
                    <h2 className="text-3xl md:text-4xl font-black text-white tracking-tight mb-2 drop-shadow-sm">
                      {cat.label}
                    </h2>
                    <p className="text-white/70 text-sm mb-4 max-w-xs">{cat.tagline}</p>
                    {count > 0 ? (
                      <span className="inline-flex items-center gap-2 rounded-full px-3 py-1.5 bg-white/10 backdrop-blur-md border border-white/20 text-white text-xs font-bold">
                        {count} model{count === 1 ? "" : "s"} supported
                      </span>
                    ) : (
                      <span className="inline-flex items-center gap-2 rounded-full px-3 py-1.5 bg-white/10 backdrop-blur-md border border-white/20 text-white/60 text-xs font-semibold">
                        Coming soon
                      </span>
                    )}
                  </div>
                </div>

                {/* Bottom accent sweep */}
                <div className="absolute bottom-0 left-0 h-[3px] w-0 group-hover:w-full bg-gradient-to-r from-red-600 via-red-500 to-transparent transition-all duration-500" />
              </Link>
            );
          })}
        </div>
      </section>
    </div>
  );
}
