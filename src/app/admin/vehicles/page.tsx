import Link from "next/link";
import Image from "next/image";
import { Plus, Bike, Factory, LayoutGrid, ScanSearch } from "lucide-react";
import { prisma } from "@/lib/prisma";

export default async function AdminVehiclesPage({
  searchParams,
}: {
  searchParams: { search?: string; category?: string };
}) {
  const search = searchParams.search?.trim();

  const vehicles = await prisma.vehicle.findMany({
    where: {
      ...(search ? { name: { contains: search, mode: "insensitive" } } : {}),
      ...(searchParams.category ? { category: searchParams.category as never } : {}),
    },
    include: {
      manufacturer: { select: { name: true, logo: true } },
      _count: { select: { generations: true, variants: true, compatibilities: true } },
    },
    orderBy: [{ sortOrder: "asc" }, { name: "asc" }],
  });

  return (
    <div>
      <div className="mb-8 flex items-center justify-between flex-wrap gap-4">
        <div>
          <h1 className="text-3xl font-black text-[var(--text-primary)] tracking-tight">Vehicle Catalog</h1>
          <p className="text-[var(--text-muted)] mt-1">{vehicles.length} models — the central compatibility engine for every product.</p>
        </div>
        <div className="flex items-center gap-3 flex-wrap">
          <Link href="/admin/vehicles/manufacturers" className="flex items-center gap-2 glass border border-[var(--border-color)] text-[var(--text-secondary)] font-bold px-4 py-2.5 rounded-xl transition-colors text-sm hover:border-red-900/40">
            <Factory size={14} /> Manufacturers
          </Link>
          <Link href="/admin/vehicles/sections" className="flex items-center gap-2 glass border border-[var(--border-color)] text-[var(--text-secondary)] font-bold px-4 py-2.5 rounded-xl transition-colors text-sm hover:border-red-900/40">
            <LayoutGrid size={14} /> Bike Sections
          </Link>
          <Link href="/admin/vehicles/detection-log" className="flex items-center gap-2 glass border border-[var(--border-color)] text-[var(--text-secondary)] font-bold px-4 py-2.5 rounded-xl transition-colors text-sm hover:border-red-900/40">
            <ScanSearch size={14} /> Detection Log
          </Link>
          <Link href="/admin/vehicles/new" className="flex items-center gap-2 bg-red-600 hover:bg-red-700 text-white font-bold px-4 py-2.5 rounded-xl transition-colors text-sm uppercase tracking-wider">
            <Plus size={16} /> Add Vehicle
          </Link>
        </div>
      </div>

      <form method="GET" action="/admin/vehicles" className="mb-6 max-w-md">
        <input
          name="search"
          defaultValue={search}
          placeholder="Search vehicle name…"
          className="w-full bg-[var(--bg-input)] border border-[var(--border-color)] rounded-xl px-4 py-2.5 text-sm text-[var(--text-primary)] focus:outline-none focus:border-red-600 placeholder:text-[var(--text-muted)]"
        />
      </form>

      <div className="glass border border-[var(--border-color)] rounded-xl overflow-hidden">
        <table className="w-full">
          <thead>
            <tr className="border-b border-[var(--border-color)]">
              <th className="px-4 py-3 text-left text-xs text-[var(--text-muted)] uppercase tracking-widest">Vehicle</th>
              <th className="px-4 py-3 text-left text-xs text-[var(--text-muted)] uppercase tracking-widest hidden md:table-cell">Category</th>
              <th className="px-4 py-3 text-left text-xs text-[var(--text-muted)] uppercase tracking-widest hidden lg:table-cell">Generations</th>
              <th className="px-4 py-3 text-left text-xs text-[var(--text-muted)] uppercase tracking-widest hidden lg:table-cell">Variants</th>
              <th className="px-4 py-3 text-left text-xs text-[var(--text-muted)] uppercase tracking-widest hidden sm:table-cell">Fitments</th>
              <th className="px-4 py-3 text-left text-xs text-[var(--text-muted)] uppercase tracking-widest">Status</th>
            </tr>
          </thead>
          <tbody className="divide-y divide-white/5">
            {vehicles.length === 0 ? (
              <tr>
                <td colSpan={6} className="px-4 py-16 text-center text-[var(--text-muted)]">
                  No vehicles found{search && ` matching "${search}"`}
                </td>
              </tr>
            ) : (
              vehicles.map((v) => (
                <tr key={v.id} className="hover:bg-white/2 transition-colors">
                  <td className="px-4 py-4">
                    <Link href={`/admin/vehicles/${v.id}/edit`} className="flex items-center gap-3 group">
                      <div className="relative w-10 h-10 bg-zinc-900 rounded-xl flex-shrink-0 overflow-hidden flex items-center justify-center">
                        {v.heroImage ? (
                          <Image src={v.heroImage} alt={v.name} fill className="object-cover" sizes="40px" unoptimized />
                        ) : (
                          <Bike size={16} className="text-gray-600" />
                        )}
                      </div>
                      <div>
                        <div className="text-[var(--text-primary)] font-bold text-sm group-hover:text-red-500 transition-colors">{v.name}</div>
                        <div className="text-[var(--text-muted)] text-xs">{v.manufacturer.name}</div>
                      </div>
                    </Link>
                  </td>
                  <td className="px-4 py-4 hidden md:table-cell">
                    <span className="text-[var(--text-muted)] text-xs">{v.category}</span>
                  </td>
                  <td className="px-4 py-4 hidden lg:table-cell">
                    <span className="text-[var(--text-muted)] text-xs">{v._count.generations}</span>
                  </td>
                  <td className="px-4 py-4 hidden lg:table-cell">
                    <span className="text-[var(--text-muted)] text-xs">{v._count.variants}</span>
                  </td>
                  <td className="px-4 py-4 hidden sm:table-cell">
                    <span className="text-[var(--text-muted)] text-xs">{v._count.compatibilities}</span>
                  </td>
                  <td className="px-4 py-4">
                    <span className={`text-xs font-semibold uppercase tracking-wider px-2 py-1 rounded-xl ${v.isActive ? "bg-green-900/20 text-green-400" : "bg-red-900/20 text-red-400"}`}>
                      {v.isActive ? "Active" : "Inactive"}
                    </span>
                  </td>
                </tr>
              ))
            )}
          </tbody>
        </table>
      </div>
    </div>
  );
}
