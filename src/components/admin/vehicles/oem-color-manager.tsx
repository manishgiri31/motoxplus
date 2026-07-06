"use client";

import { EntityManager } from "@/components/admin/vehicles/entity-manager";

export function OemColorManager({ manufacturerId }: { manufacturerId: string }) {
  return (
    <EntityManager
      title="OEM Colors"
      apiBase={`/api/admin/vehicles/manufacturers/${manufacturerId}/colors`}
      emptyMessage="No OEM colors yet."
      fields={[
        { key: "name", label: "Name", type: "text", required: true, placeholder: "Sports Red" },
        { key: "hex", label: "Hex", type: "color", required: true },
        { key: "paintCode", label: "Paint Code", type: "text", placeholder: "H-RD-101" },
        { key: "colorCode", label: "Color Code", type: "text" },
        { key: "finish", label: "Finish", type: "text", placeholder: "Glossy / Matte / Metallic / Pearl" },
        { key: "sortOrder", label: "Sort Order", type: "number" },
        { key: "isActive", label: "Active", type: "checkbox" },
      ]}
      columns={[
        {
          key: "hex",
          label: "Swatch",
          render: (r) => <span className="inline-block w-5 h-5 rounded-full border border-white/20 align-middle" style={{ background: r.hex }} />,
        },
        { key: "name", label: "Name" },
        { key: "paintCode", label: "Paint Code" },
        { key: "finish", label: "Finish" },
      ]}
      toFormValues={(r) => ({
        name: r.name,
        hex: r.hex,
        paintCode: r.paintCode || "",
        colorCode: r.colorCode || "",
        finish: r.finish || "",
        sortOrder: String(r.sortOrder ?? 0),
        isActive: String(r.isActive),
      })}
    />
  );
}
