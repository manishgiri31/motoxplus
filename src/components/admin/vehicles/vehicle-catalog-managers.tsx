"use client";

import { useCallback, useEffect, useState } from "react";
import { EntityManager } from "@/components/admin/vehicles/entity-manager";

const EMISSION_OPTIONS = [
  { value: "BS3", label: "BS3" },
  { value: "BS4", label: "BS4" },
  { value: "BS6", label: "BS6" },
  { value: "BS6_PHASE2", label: "BS6 Phase 2" },
];
const FORMAT_OPTIONS = [
  { value: "GLB", label: "GLB" },
  { value: "GLTF", label: "GLTF" },
  { value: "USDZ", label: "USDZ" },
];

interface Lookups {
  generations: { id: string; name: string }[];
  variants: { id: string; name: string }[];
  colors: { id: string; name: string }[];
  oemColors: { id: string; name: string; paintCode: string | null }[];
}

/**
 * Fetches the vehicle's current generations/variants/colors (plus the
 * manufacturer's OEM color library) once, so the sibling managers below can
 * offer cascading selects (variant → generation, color → OEM color, 3D
 * model/spin → variant + color) without each re-querying the whole vehicle.
 * `refreshKey` is bumped whenever a manager reports a change via `onChanged`,
 * so e.g. adding a generation immediately shows up in the variant picker.
 */
function useVehicleLookups(vehicleId: string, manufacturerId: string) {
  const [lookups, setLookups] = useState<Lookups>({ generations: [], variants: [], colors: [], oemColors: [] });
  const [refreshKey, setRefreshKey] = useState(0);
  const refresh = useCallback(() => setRefreshKey((k) => k + 1), []);

  useEffect(() => {
    (async () => {
      const [vehicleRes, oemRes] = await Promise.all([
        fetch(`/api/admin/vehicles/${vehicleId}`),
        fetch(`/api/admin/vehicles/manufacturers/${manufacturerId}/colors`),
      ]);
      const vehicle = vehicleRes.ok ? await vehicleRes.json() : null;
      const oemColors = oemRes.ok ? await oemRes.json() : [];
      setLookups({
        generations: vehicle?.generations ?? [],
        variants: vehicle?.variants ?? [],
        colors: vehicle?.colors ?? [],
        oemColors,
      });
    })();
  }, [vehicleId, manufacturerId, refreshKey]);

  return { lookups, refresh };
}

export function VehicleCatalogManagers({ vehicleId, manufacturerId }: { vehicleId: string; manufacturerId: string }) {
  const { lookups, refresh } = useVehicleLookups(vehicleId, manufacturerId);
  const generationOptions = lookups.generations.map((g) => ({ value: g.id, label: g.name }));
  const variantOptions = lookups.variants.map((v) => ({ value: v.id, label: v.name }));
  const colorOptions = lookups.colors.map((c) => ({ value: c.id, label: c.name }));
  const oemColorOptions = lookups.oemColors.map((c) => ({ value: c.id, label: c.paintCode ? `${c.name} (${c.paintCode})` : c.name }));

  const byId = <T extends { id: string; name: string }>(list: T[], id: string | null) =>
    list.find((x) => x.id === id)?.name ?? "—";

  return (
    <div className="space-y-6">
      <EntityManager
        title="Generations"
        description="Model generations spanning a year range (e.g. pre/post facelift, BS4/BS6 platform change)."
        apiBase={`/api/admin/vehicles/${vehicleId}/generations`}
        onChanged={refresh}
        emptyMessage="No generations yet."
        fields={[
          { key: "name", label: "Name", type: "text", required: true, placeholder: "Gen 2 (BS6)" },
          { key: "codeName", label: "Code Name", type: "text" },
          { key: "yearFrom", label: "Year From", type: "number", required: true },
          { key: "yearTo", label: "Year To", type: "number", placeholder: "Blank = present" },
          { key: "description", label: "Description", type: "textarea", span: 4 },
          { key: "sortOrder", label: "Sort Order", type: "number" },
          { key: "isActive", label: "Active", type: "checkbox" },
        ]}
        columns={[
          { key: "name", label: "Name" },
          { key: "codeName", label: "Code" },
          { key: "years", label: "Years", render: (r) => `${r.yearFrom}–${r.yearTo ?? "present"}` },
        ]}
        toFormValues={(r) => ({
          name: r.name,
          codeName: r.codeName || "",
          yearFrom: String(r.yearFrom),
          yearTo: r.yearTo != null ? String(r.yearTo) : "",
          description: r.description || "",
          sortOrder: String(r.sortOrder ?? 0),
          isActive: String(r.isActive),
        })}
      />

      <EntityManager
        title="Variants"
        description="Exact fitment configurations — brake type, start type, emission standard, transmission — nested under a generation."
        apiBase={`/api/admin/vehicles/${vehicleId}/variants`}
        onChanged={refresh}
        emptyMessage="No variants yet."
        fields={[
          { key: "name", label: "Name", type: "text", required: true, placeholder: "Disc, Self Start (BS6)" },
          { key: "slug", label: "Slug", type: "text", required: true, placeholder: "disc-self-bs6" },
          { key: "generationId", label: "Generation", type: "select", options: generationOptions },
          { key: "emissionStandard", label: "Emission Standard", type: "select", options: EMISSION_OPTIONS },
          { key: "brakeType", label: "Brake Type", type: "text", placeholder: "Disc / Drum" },
          { key: "startType", label: "Start Type", type: "text", placeholder: "Self / Kick" },
          { key: "transmission", label: "Transmission", type: "text" },
          { key: "fuelType", label: "Fuel Type", type: "text" },
          { key: "engineCc", label: "Engine (cc)", type: "number" },
          { key: "yearFrom", label: "Year From", type: "number" },
          { key: "yearTo", label: "Year To", type: "number" },
          { key: "chassisPrefix", label: "Chassis Prefix", type: "text" },
          { key: "sortOrder", label: "Sort Order", type: "number" },
          { key: "isActive", label: "Active", type: "checkbox" },
        ]}
        columns={[
          { key: "name", label: "Name" },
          { key: "generationId", label: "Generation", render: (r) => byId(lookups.generations, r.generationId) },
          { key: "emissionStandard", label: "Emission" },
          { key: "brakeType", label: "Brake" },
        ]}
        toFormValues={(r) => ({
          name: r.name,
          slug: r.slug,
          generationId: r.generationId || "",
          emissionStandard: r.emissionStandard || "",
          brakeType: r.brakeType || "",
          startType: r.startType || "",
          transmission: r.transmission || "",
          fuelType: r.fuelType || "",
          engineCc: r.engineCc != null ? String(r.engineCc) : "",
          yearFrom: r.yearFrom != null ? String(r.yearFrom) : "",
          yearTo: r.yearTo != null ? String(r.yearTo) : "",
          chassisPrefix: r.chassisPrefix || "",
          sortOrder: String(r.sortOrder ?? 0),
          isActive: String(r.isActive),
        })}
      />

      <EntityManager
        title="Colors"
        description="Public-facing color swatches, optionally linked to the manufacturer's OEM paint code library."
        apiBase={`/api/admin/vehicles/${vehicleId}/colors`}
        onChanged={refresh}
        emptyMessage="No colors yet."
        fields={[
          { key: "name", label: "Name", type: "text", required: true },
          { key: "hex", label: "Hex", type: "color", required: true },
          { key: "oemColorId", label: "OEM Color Link", type: "select", options: oemColorOptions },
          { key: "image", label: "Image URL", type: "text", span: 2 },
          { key: "sortOrder", label: "Sort Order", type: "number" },
        ]}
        columns={[
          { key: "hex", label: "Swatch", render: (r) => <span className="inline-block w-5 h-5 rounded-full border border-white/20 align-middle" style={{ background: r.hex }} /> },
          { key: "name", label: "Name" },
          { key: "oemColorId", label: "OEM Link", render: (r) => (r.oemColor ? r.oemColor.name : "—") },
        ]}
        toFormValues={(r) => ({
          name: r.name,
          hex: r.hex,
          oemColorId: r.oemColorId || "",
          image: r.image || "",
          sortOrder: String(r.sortOrder ?? 0),
        })}
      />

      <EntityManager
        title="Gallery"
        description="Additional gallery photos shown on the public vehicle page."
        apiBase={`/api/admin/vehicles/${vehicleId}/gallery`}
        emptyMessage="No gallery images yet."
        fields={[
          { key: "imageUrl", label: "Image URL", type: "text", required: true, span: 3 },
          { key: "sortOrder", label: "Sort Order", type: "number" },
        ]}
        columns={[
          { key: "preview", label: "Preview", render: (r) => <img src={r.imageUrl} alt="" className="w-10 h-10 object-cover rounded-lg" /> },
          { key: "imageUrl", label: "URL" },
        ]}
        toFormValues={(r) => ({ imageUrl: r.imageUrl, sortOrder: String(r.sortOrder ?? 0) })}
      />

      <EntityManager
        title="3D Models (GLB/GLTF/USDZ)"
        description="Optionally scoped to a specific variant and/or color — the most specific match wins on the public page."
        apiBase={`/api/admin/vehicles/${vehicleId}/models-3d`}
        emptyMessage="No 3D models yet."
        fields={[
          { key: "url", label: "Model URL", type: "text", required: true, span: 3 },
          { key: "format", label: "Format", type: "select", options: FORMAT_OPTIONS },
          { key: "variantId", label: "Variant", type: "select", options: variantOptions },
          { key: "colorId", label: "Color", type: "select", options: colorOptions },
          { key: "sortOrder", label: "Sort Order", type: "number" },
        ]}
        columns={[
          { key: "format", label: "Format" },
          { key: "url", label: "URL" },
          { key: "variantId", label: "Variant", render: (r) => byId(lookups.variants, r.variantId) },
          { key: "colorId", label: "Color", render: (r) => byId(lookups.colors, r.colorId) },
        ]}
        toFormValues={(r) => ({
          url: r.url,
          format: r.format,
          variantId: r.variantId || "",
          colorId: r.colorId || "",
          sortOrder: String(r.sortOrder ?? 0),
        })}
      />

      <EntityManager
        title="360° Spin Sets"
        description="Ordered frame-image URLs (one per line) for the drag-to-rotate viewer."
        apiBase={`/api/admin/vehicles/${vehicleId}/spins`}
        emptyMessage="No 360° spin sets yet."
        fields={[
          { key: "frameUrls", label: "Frame URLs (one per line)", type: "textarea", required: true, span: 4 },
          { key: "variantId", label: "Variant", type: "select", options: variantOptions },
          { key: "colorId", label: "Color", type: "select", options: colorOptions },
          { key: "sortOrder", label: "Sort Order", type: "number" },
        ]}
        columns={[
          { key: "frameCount", label: "Frames" },
          { key: "variantId", label: "Variant", render: (r) => byId(lookups.variants, r.variantId) },
          { key: "colorId", label: "Color", render: (r) => byId(lookups.colors, r.colorId) },
        ]}
        toFormValues={(r) => ({
          frameUrls: (r.frameUrls as string[]).join("\n"),
          variantId: r.variantId || "",
          colorId: r.colorId || "",
          sortOrder: String(r.sortOrder ?? 0),
        })}
      />

      <EntityManager
        title="VIN Patterns"
        description="World-Manufacturer-Identifier + optional VDS regex, used by the VIN decoder to resolve a chassis number to this vehicle."
        apiBase={`/api/admin/vehicles/${vehicleId}/vin-patterns`}
        emptyMessage="No VIN patterns yet."
        fields={[
          { key: "wmi", label: "WMI", type: "text", required: true, placeholder: "MD2" },
          { key: "vdsPattern", label: "VDS Regex", type: "text", placeholder: "^MD2A11" },
          { key: "variantId", label: "Variant", type: "select", options: variantOptions },
          { key: "yearCode", label: "Year Code", type: "text" },
          { key: "description", label: "Description", type: "textarea", span: 4 },
        ]}
        columns={[
          { key: "wmi", label: "WMI" },
          { key: "vdsPattern", label: "VDS Regex" },
          { key: "variantId", label: "Variant", render: (r) => byId(lookups.variants, r.variantId) },
        ]}
        toFormValues={(r) => ({
          wmi: r.wmi,
          vdsPattern: r.vdsPattern || "",
          variantId: r.variantId || "",
          yearCode: r.yearCode || "",
          description: r.description || "",
        })}
      />
    </div>
  );
}
