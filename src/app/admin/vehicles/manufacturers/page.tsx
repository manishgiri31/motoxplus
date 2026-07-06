"use client";

import Link from "next/link";
import { ArrowLeft, Pencil } from "lucide-react";
import { EntityManager } from "@/components/admin/vehicles/entity-manager";

export default function ManufacturersPage() {
  return (
    <div className="max-w-4xl">
      <div className="mb-8">
        <Link href="/admin/vehicles" className="text-[var(--text-muted)] hover:text-red-500 text-xs uppercase tracking-widest font-semibold flex items-center gap-1.5 mb-3">
          <ArrowLeft size={12} /> Back to Vehicles
        </Link>
        <h1 className="text-3xl font-black text-[var(--text-primary)] tracking-tight">Manufacturers</h1>
        <p className="text-[var(--text-muted)] mt-1">
          OEMs and their VIN world-manufacturer-identifier (WMI) prefix. Manage each manufacturer&apos;s OEM color library from its detail link.
        </p>
      </div>

      <EntityManager
        title="Manufacturers"
        apiBase="/api/admin/vehicles/manufacturers"
        emptyMessage="No manufacturers yet."
        fields={[
          { key: "name", label: "Name", type: "text", required: true, placeholder: "Bajaj" },
          { key: "slug", label: "Slug", type: "text", required: true, placeholder: "bajaj" },
          { key: "logo", label: "Logo URL", type: "text", span: 2 },
          { key: "wmi", label: "VIN WMI Prefix", type: "text", placeholder: "MD2" },
          { key: "sortOrder", label: "Sort Order", type: "number" },
          { key: "isActive", label: "Active", type: "checkbox" },
        ]}
        columns={[
          { key: "name", label: "Name" },
          { key: "slug", label: "Slug" },
          { key: "wmi", label: "WMI" },
          { key: "_count", label: "Vehicles", render: (r) => String(r._count?.vehicles ?? 0) },
          {
            key: "colors",
            label: "OEM Colors",
            render: (r) => (
              <Link href={`/admin/vehicles/manufacturers/${r.id}`} className="text-red-500 hover:text-red-400 flex items-center gap-1">
                {r._count?.oemColors ?? 0} <Pencil size={10} />
              </Link>
            ),
          },
        ]}
        toFormValues={(r) => ({
          name: r.name,
          slug: r.slug,
          logo: r.logo || "",
          wmi: r.wmi || "",
          sortOrder: String(r.sortOrder ?? 0),
          isActive: String(r.isActive),
        })}
      />
    </div>
  );
}
