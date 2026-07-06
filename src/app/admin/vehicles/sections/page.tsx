"use client";

import Link from "next/link";
import { ArrowLeft } from "lucide-react";
import { EntityManager } from "@/components/admin/vehicles/entity-manager";

export default function VehicleSectionsPage() {
  return (
    <div className="max-w-4xl">
      <div className="mb-8">
        <Link href="/admin/vehicles" className="text-[var(--text-muted)] hover:text-red-500 text-xs uppercase tracking-widest font-semibold flex items-center gap-1.5 mb-3">
          <ArrowLeft size={12} /> Back to Vehicles
        </Link>
        <h1 className="text-3xl font-black text-[var(--text-primary)] tracking-tight">Bike Sections</h1>
        <p className="text-[var(--text-muted)] mt-1">
          Global part-section taxonomy (Engine, Braking, Suspension…) used for section navigation, parts diagrams and the fitment matrix.
        </p>
      </div>

      <EntityManager
        title="Sections"
        apiBase="/api/admin/vehicles/sections"
        emptyMessage="No sections yet — add Engine, Braking, Suspension, etc."
        fields={[
          { key: "name", label: "Name", type: "text", required: true, placeholder: "Braking" },
          { key: "slug", label: "Slug", type: "text", required: true, placeholder: "braking" },
          { key: "icon", label: "Icon key", type: "text", placeholder: "disc" },
          { key: "description", label: "Description", type: "textarea", span: 2 },
          { key: "sortOrder", label: "Sort Order", type: "number" },
          { key: "isActive", label: "Active", type: "checkbox" },
        ]}
        columns={[
          { key: "name", label: "Name" },
          { key: "slug", label: "Slug" },
          { key: "isActive", label: "Active", render: (r) => (r.isActive ? "Yes" : "No") },
        ]}
        toFormValues={(r) => ({
          name: r.name,
          slug: r.slug,
          icon: r.icon || "",
          description: r.description || "",
          sortOrder: String(r.sortOrder ?? 0),
          isActive: String(r.isActive),
        })}
      />
    </div>
  );
}
