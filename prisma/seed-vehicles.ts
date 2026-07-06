/**
 * Seeds VehicleManufacturer + Vehicle records for the Smart Vehicle Explorer.
 * Model list is drawn from real compatibility strings already on the
 * "FRONT MUDGUARD" master product (see prisma/seed-mudguard.ts) plus the
 * marquee non-Hero/Honda models named in the product brief.
 *
 * Engine CC is public, well-known spec data. Power/torque/mileage/weight/
 * fuelTank/heroImage/colors/gallery/modelUrl are intentionally left null —
 * the UI shows "coming soon" until real assets are supplied.
 * Run: npm run db:seed-vehicles
 */
import { PrismaClient, VehicleCategory } from "@prisma/client";

const prisma = new PrismaClient();

interface ManufacturerSeed {
  name: string;
  slug: string;
}

interface VehicleSeed {
  name: string;
  slug: string;
  manufacturerSlug: string;
  category: VehicleCategory;
  engineCc: number;
  searchAliases: string[];
}

const MANUFACTURERS: ManufacturerSeed[] = [
  { name: "Hero", slug: "hero" },
  { name: "Honda", slug: "honda" },
  { name: "TVS", slug: "tvs" },
  { name: "Bajaj", slug: "bajaj" },
  { name: "Yamaha", slug: "yamaha" },
  { name: "Royal Enfield", slug: "royal-enfield" },
  { name: "Suzuki", slug: "suzuki" },
];

const VEHICLES: VehicleSeed[] = [
  { name: "Splendor Plus", slug: "splendor-plus", manufacturerSlug: "hero", category: "MOTORCYCLE", engineCc: 97.2, searchAliases: ["Hero Splendor", "Splendor Plus", "Splendor NXG"] },
  { name: "Splendor iSmart", slug: "splendor-ismart", manufacturerSlug: "hero", category: "MOTORCYCLE", engineCc: 113.2, searchAliases: ["Splendor i-Smart", "i-Smart"] },
  { name: "Super Splendor", slug: "super-splendor", manufacturerSlug: "hero", category: "MOTORCYCLE", engineCc: 124.7, searchAliases: ["Hero Super Splendor", "Super Splendor"] },
  { name: "HF Deluxe", slug: "hf-deluxe", manufacturerSlug: "hero", category: "MOTORCYCLE", engineCc: 97.2, searchAliases: ["Hero CD Deluxe", "CD Deluxe", "Hero CD Dawn", "CD Dawn", "HF Deluxe"] },
  { name: "Passion Pro", slug: "passion-pro", manufacturerSlug: "hero", category: "MOTORCYCLE", engineCc: 110, searchAliases: ["Hero Passion Pro", "Hero Passion"] },
  { name: "Passion Plus", slug: "passion-plus", manufacturerSlug: "hero", category: "MOTORCYCLE", engineCc: 97.2, searchAliases: ["Hero Passion Plus"] },
  { name: "Passion Xpro", slug: "passion-xpro", manufacturerSlug: "hero", category: "MOTORCYCLE", engineCc: 110, searchAliases: ["Hero Passion Xpro", "Passion Xpro"] },
  { name: "Glamour", slug: "glamour", manufacturerSlug: "hero", category: "MOTORCYCLE", engineCc: 124.7, searchAliases: ["Hero Glamour", "Glamour"] },
  { name: "CBZ Xtreme", slug: "cbz-xtreme", manufacturerSlug: "hero", category: "MOTORCYCLE", engineCc: 149.2, searchAliases: ["Hero CBZ Xtreme", "Hero CBZ Star", "Hero Ambition", "Hero CBZ"] },
  { name: "Karizma", slug: "karizma", manufacturerSlug: "hero", category: "MOTORCYCLE", engineCc: 223, searchAliases: ["Hero Karizma"] },
  { name: "Hunk", slug: "hunk", manufacturerSlug: "hero", category: "MOTORCYCLE", engineCc: 149.2, searchAliases: ["Hero Hunk", "Hero Honda Hunk"] },
  { name: "Maestro Edge", slug: "maestro-edge", manufacturerSlug: "hero", category: "SCOOTER", engineCc: 110.9, searchAliases: ["Hero Maestro", "Maestro"] },

  { name: "CB Shine", slug: "cb-shine", manufacturerSlug: "honda", category: "MOTORCYCLE", engineCc: 124.7, searchAliases: ["Honda CB Shine", "CB Shine"] },
  { name: "CB Unicorn", slug: "cb-unicorn", manufacturerSlug: "honda", category: "MOTORCYCLE", engineCc: 149.1, searchAliases: ["Honda CB Unicorn", "CB Unicorn", "Unicorn"] },
  { name: "Activa 6G", slug: "activa-6g", manufacturerSlug: "honda", category: "SCOOTER", engineCc: 109.51, searchAliases: ["Activa"] },

  { name: "Apache RTR 160", slug: "apache-rtr-160", manufacturerSlug: "tvs", category: "MOTORCYCLE", engineCc: 159.7, searchAliases: ["Apache RTR 160", "Apache RTR", "TVS Apache"] },
  { name: "Jupiter", slug: "jupiter", manufacturerSlug: "tvs", category: "SCOOTER", engineCc: 109.7, searchAliases: ["TVS Jupiter", "Jupiter"] },

  { name: "Pulsar 150", slug: "pulsar-150", manufacturerSlug: "bajaj", category: "MOTORCYCLE", engineCc: 149.5, searchAliases: ["Pulsar 150", "Bajaj Pulsar 150"] },
  { name: "Pulsar 220F", slug: "pulsar-220f", manufacturerSlug: "bajaj", category: "MOTORCYCLE", engineCc: 220, searchAliases: ["Pulsar 220", "Bajaj Pulsar 220"] },

  { name: "FZ", slug: "fz", manufacturerSlug: "yamaha", category: "MOTORCYCLE", engineCc: 149, searchAliases: ["Yamaha FZ", "FZ-S", "FZ"] },
  { name: "R15", slug: "r15", manufacturerSlug: "yamaha", category: "MOTORCYCLE", engineCc: 155, searchAliases: ["Yamaha R15", "YZF R15", "R15"] },

  { name: "Classic 350", slug: "classic-350", manufacturerSlug: "royal-enfield", category: "MOTORCYCLE", engineCc: 349, searchAliases: ["Royal Enfield Classic 350", "Classic 350"] },

  { name: "Access 125", slug: "access-125", manufacturerSlug: "suzuki", category: "SCOOTER", engineCc: 124, searchAliases: ["Suzuki Access", "Access 125", "Access"] },
];

// --- Catalog-engine demo data (generations, variants, OEM colors, VIN
// patterns, compatibility matrix, parts diagram) for a handful of flagship
// models. Everything below is additive and idempotent (findFirst-or-create),
// exercising the compatibility engine without requiring new unique
// constraints on the demo-only join tables.

const PART_SECTIONS = [
  { name: "Engine", slug: "engine", icon: "engine" },
  { name: "Braking", slug: "braking", icon: "disc" },
  { name: "Suspension", slug: "suspension", icon: "suspension" },
  { name: "Transmission", slug: "transmission", icon: "gear" },
  { name: "Electrical", slug: "electrical", icon: "bolt" },
  { name: "Lighting", slug: "lighting", icon: "lightbulb" },
  { name: "Body & Fairing", slug: "body-fairing", icon: "shield" },
  { name: "Wheels & Tyres", slug: "wheels-tyres", icon: "circle" },
  { name: "Controls & Cables", slug: "controls-cables", icon: "cable" },
  { name: "Fuel System", slug: "fuel-system", icon: "fuel" },
  { name: "Exhaust", slug: "exhaust", icon: "wind" },
];

const OEM_COLORS: { manufacturerSlug: string; name: string; paintCode: string; hex: string; finish: string }[] = [
  { manufacturerSlug: "hero", name: "Sports Red", paintCode: "H-RD-101", hex: "#C8102E", finish: "Glossy" },
  { manufacturerSlug: "hero", name: "Panther Black", paintCode: "H-BK-102", hex: "#1A1A1A", finish: "Glossy" },
  { manufacturerSlug: "hero", name: "Techno Blue", paintCode: "H-BL-103", hex: "#1E3A8A", finish: "Metallic" },
  { manufacturerSlug: "honda", name: "Pearl Nightstar Black", paintCode: "NH-A64P", hex: "#0B0B0B", finish: "Pearl" },
  { manufacturerSlug: "honda", name: "Athletic Blue Metallic", paintCode: "NH-B95M", hex: "#1B3A6B", finish: "Metallic" },
  { manufacturerSlug: "bajaj", name: "Ebony Black", paintCode: "BJ-EB-01", hex: "#111111", finish: "Glossy" },
  { manufacturerSlug: "bajaj", name: "Blue Fire", paintCode: "BJ-BF-02", hex: "#0047AB", finish: "Glossy" },
];

async function upsertOemColor(
  manufacturerId: string,
  c: { name: string; paintCode: string; hex: string; finish: string },
  sortOrder: number
) {
  const existing = await prisma.oemColor.findFirst({ where: { manufacturerId, name: c.name } });
  if (existing) {
    return prisma.oemColor.update({ where: { id: existing.id }, data: { hex: c.hex, paintCode: c.paintCode, finish: c.finish } });
  }
  return prisma.oemColor.create({
    data: { manufacturerId, name: c.name, paintCode: c.paintCode, hex: c.hex, finish: c.finish, sortOrder },
  });
}

async function upsertGeneration(
  vehicleId: string,
  name: string,
  data: { codeName?: string; yearFrom: number; yearTo?: number; description?: string; sortOrder: number }
) {
  const existing = await prisma.vehicleGeneration.findFirst({ where: { vehicleId, name } });
  if (existing) {
    return prisma.vehicleGeneration.update({ where: { id: existing.id }, data });
  }
  return prisma.vehicleGeneration.create({ data: { vehicleId, name, ...data } });
}

async function upsertProductCompatibility(data: {
  productId: string;
  vehicleId: string;
  generationId?: string | null;
  variantId?: string | null;
  sectionId?: string | null;
  confidence: "VERIFIED" | "LIKELY" | "UNVERIFIED";
  source: "MANUAL" | "OEM_CATALOG";
  fitmentNote?: string;
}) {
  const existing = await prisma.productCompatibility.findFirst({
    where: {
      productId: data.productId,
      vehicleId: data.vehicleId,
      generationId: data.generationId ?? null,
      variantId: data.variantId ?? null,
      sectionId: data.sectionId ?? null,
    },
  });
  if (existing) {
    return prisma.productCompatibility.update({ where: { id: existing.id }, data });
  }
  return prisma.productCompatibility.create({ data });
}

async function seedCatalogEngineDemo(
  manufacturerIds: Record<string, string>,
  vehicleIds: Record<string, string>
) {
  console.log("Seeding vehicle part sections…");
  const sectionIds: Record<string, string> = {};
  for (let i = 0; i < PART_SECTIONS.length; i++) {
    const s = PART_SECTIONS[i];
    const record = await prisma.vehiclePartSection.upsert({
      where: { slug: s.slug },
      create: { name: s.name, slug: s.slug, icon: s.icon, sortOrder: i },
      update: { name: s.name, icon: s.icon },
    });
    sectionIds[s.slug] = record.id;
  }

  console.log("Seeding OEM color library…");
  const oemColorIds: Record<string, string> = {};
  for (let i = 0; i < OEM_COLORS.length; i++) {
    const c = OEM_COLORS[i];
    const manufacturerId = manufacturerIds[c.manufacturerSlug];
    if (!manufacturerId) continue;
    const record = await upsertOemColor(manufacturerId, c, i);
    oemColorIds[`${c.manufacturerSlug}:${c.name}`] = record.id;
  }
  // Set manufacturer WMI (world manufacturer identifier) prefixes for VIN decoding.
  await prisma.vehicleManufacturer.update({ where: { id: manufacturerIds.hero }, data: { wmi: "MBL" } });
  await prisma.vehicleManufacturer.update({ where: { id: manufacturerIds.honda }, data: { wmi: "MD6" } });
  await prisma.vehicleManufacturer.update({ where: { id: manufacturerIds.bajaj }, data: { wmi: "MD2" } });

  // Give the OEM color swatches to each vehicle's existing VehicleColor rows
  // where the color names line up (keeps existing ad-hoc colors, just links them).
  const linkTargets: { vehicleSlug: string; colorName: string; oemKey: string }[] = [
    { vehicleSlug: "splendor-plus", colorName: "Sports Red", oemKey: "hero:Sports Red" },
    { vehicleSlug: "splendor-plus", colorName: "Panther Black", oemKey: "hero:Panther Black" },
    { vehicleSlug: "activa-6g", colorName: "Pearl Nightstar Black", oemKey: "honda:Pearl Nightstar Black" },
    { vehicleSlug: "pulsar-150", colorName: "Ebony Black", oemKey: "bajaj:Ebony Black" },
  ];
  for (const t of linkTargets) {
    const vehicleId = vehicleIds[t.vehicleSlug];
    const oemColorId = oemColorIds[t.oemKey];
    if (!vehicleId || !oemColorId) continue;
    const color = await prisma.vehicleColor.findFirst({ where: { vehicleId, name: t.colorName } });
    if (color) {
      await prisma.vehicleColor.update({ where: { id: color.id }, data: { oemColorId } });
    } else {
      await prisma.vehicleColor.create({
        data: { vehicleId, name: t.colorName, hex: "#1A1A1A", oemColorId, sortOrder: 0 },
      });
    }
  }

  console.log("Seeding generations, variants, VIN patterns…");

  // Splendor Plus — two generations spanning drum/disc brake and BS4/BS6 emission norms.
  const splendorId = vehicleIds["splendor-plus"];
  if (splendorId) {
    const gen1 = await upsertGeneration(splendorId, "Gen 1 (Kick/Self, BS4)", {
      yearFrom: 2016,
      yearTo: 2020,
      sortOrder: 0,
    });
    const gen2 = await upsertGeneration(splendorId, "Gen 2 (BS6)", { yearFrom: 2020, sortOrder: 1 });

    const variantDefs = [
      { generation: gen1, slug: "drum-kick-bs4", name: "Drum, Kick Start (BS4)", emissionStandard: "BS4", brakeType: "Drum", startType: "Kick", yearFrom: 2016, yearTo: 2020 },
      { generation: gen1, slug: "drum-self-bs4", name: "Drum, Self Start (BS4)", emissionStandard: "BS4", brakeType: "Drum", startType: "Self", yearFrom: 2016, yearTo: 2020 },
      { generation: gen2, slug: "drum-self-bs6", name: "Drum, Self Start (BS6)", emissionStandard: "BS6", brakeType: "Drum", startType: "Self", yearFrom: 2020, yearTo: null },
      { generation: gen2, slug: "disc-self-bs6", name: "Disc, Self Start (BS6)", emissionStandard: "BS6", brakeType: "Disc", startType: "Self", yearFrom: 2020, yearTo: null },
    ] as const;

    const splendorVariantIds: Record<string, string> = {};
    for (let i = 0; i < variantDefs.length; i++) {
      const v = variantDefs[i];
      const record = await prisma.vehicleVariant.upsert({
        where: { vehicleId_slug: { vehicleId: splendorId, slug: v.slug } },
        create: {
          vehicleId: splendorId,
          generationId: v.generation.id,
          slug: v.slug,
          name: v.name,
          emissionStandard: v.emissionStandard as never,
          brakeType: v.brakeType,
          startType: v.startType,
          yearFrom: v.yearFrom,
          yearTo: v.yearTo,
          sortOrder: i,
        },
        update: {
          generationId: v.generation.id,
          name: v.name,
          emissionStandard: v.emissionStandard as never,
          brakeType: v.brakeType,
          startType: v.startType,
          yearFrom: v.yearFrom,
          yearTo: v.yearTo,
        },
      });
      splendorVariantIds[v.slug] = record.id;
    }

    await prisma.vehicle.update({
      where: { id: splendorId },
      data: {
        badgeText: "SPLENDOR",
        ocrKeywords: ["SPLENDOR", "SPLENDOR PLUS", "HERO SPLENDOR"],
        aiLabels: ["hero-splendor", "commuter-motorcycle", "100cc-motorcycle"],
      },
    });

    const existingSplendorVin = await prisma.vehicleVinPattern.findFirst({ where: { wmi: "MBL", vehicleId: splendorId } });
    if (!existingSplendorVin) {
      await prisma.vehicleVinPattern.create({
        data: {
          manufacturerId: manufacturerIds.hero,
          vehicleId: splendorId,
          wmi: "MBL",
          vdsPattern: "^MBLHA10",
          description: "Hero Splendor Plus chassis prefix",
        },
      });
    }

    // Parts diagram + hotspots for the Splendor Plus (front section).
    let diagram = await prisma.vehicleDiagram.findFirst({ where: { vehicleId: splendorId, name: "Front End Assembly" } });
    if (!diagram) {
      diagram = await prisma.vehicleDiagram.create({
        data: {
          vehicleId: splendorId,
          sectionId: sectionIds["body-fairing"],
          name: "Front End Assembly",
          imageUrl: "/vehicles/diagrams/splendor-front-end.svg",
          sortOrder: 0,
        },
      });
    }
    await prisma.vehicleDiagramHotspot.deleteMany({ where: { diagramId: diagram.id } });
    const mudguard = await prisma.product.findFirst({ where: { name: "FRONT MUDGUARD" } });
    await prisma.vehicleDiagramHotspot.createMany({
      data: [
        { diagramId: diagram.id, x: 50, y: 78, label: "Front Mudguard", calloutNumber: 1, sectionId: sectionIds["body-fairing"], productId: mudguard?.id ?? null, sortOrder: 0 },
        { diagramId: diagram.id, x: 32, y: 55, label: "Front Brake Drum", calloutNumber: 2, sectionId: sectionIds["braking"], sortOrder: 1 },
        { diagramId: diagram.id, x: 62, y: 30, label: "Headlamp Assembly", calloutNumber: 3, sectionId: sectionIds["lighting"], sortOrder: 2 },
      ],
    });

    // Compatibility matrix demo: link FRONT MUDGUARD to the Splendor Plus with
    // mixed confidence across variants.
    if (mudguard) {
      await upsertProductCompatibility({
        productId: mudguard.id,
        vehicleId: splendorId,
        variantId: splendorVariantIds["drum-self-bs6"],
        sectionId: sectionIds["body-fairing"],
        confidence: "VERIFIED",
        source: "OEM_CATALOG",
        fitmentNote: "OEM cross-referenced, direct fit.",
      });
      await upsertProductCompatibility({
        productId: mudguard.id,
        vehicleId: splendorId,
        variantId: splendorVariantIds["disc-self-bs6"],
        sectionId: sectionIds["body-fairing"],
        confidence: "LIKELY",
        source: "MANUAL",
        fitmentNote: "Same mounting points as the drum variant; unverified on disc brake bodywork.",
      });
      await upsertProductCompatibility({
        productId: mudguard.id,
        vehicleId: splendorId,
        generationId: gen1.id,
        sectionId: sectionIds["body-fairing"],
        confidence: "VERIFIED",
        source: "OEM_CATALOG",
        fitmentNote: "Fits all Gen 1 (BS4) variants.",
      });
    }
  }

  // Pulsar 150 — single BS6 variant for the compatibility/VIN demo.
  const pulsarId = vehicleIds["pulsar-150"];
  if (pulsarId) {
    const variant = await prisma.vehicleVariant.upsert({
      where: { vehicleId_slug: { vehicleId: pulsarId, slug: "single-disc-bs6" } },
      create: {
        vehicleId: pulsarId,
        slug: "single-disc-bs6",
        name: "Single Disc (BS6)",
        emissionStandard: "BS6",
        brakeType: "Disc",
        startType: "Self",
        yearFrom: 2020,
        sortOrder: 0,
      },
      update: { emissionStandard: "BS6", brakeType: "Disc", startType: "Self", yearFrom: 2020 },
    });
    await prisma.vehicle.update({
      where: { id: pulsarId },
      data: {
        badgeText: "PULSAR",
        ocrKeywords: ["PULSAR", "PULSAR 150", "BAJAJ PULSAR"],
        aiLabels: ["bajaj-pulsar", "sport-commuter-motorcycle", "150cc-motorcycle"],
      },
    });
    const existingVin = await prisma.vehicleVinPattern.findFirst({ where: { wmi: "MD2", vehicleId: pulsarId } });
    if (!existingVin) {
      await prisma.vehicleVinPattern.create({
        data: {
          manufacturerId: manufacturerIds.bajaj,
          vehicleId: pulsarId,
          variantId: variant.id,
          wmi: "MD2",
          vdsPattern: "^MD2A11",
          description: "Bajaj Pulsar 150 chassis prefix",
        },
      });
    }
  }

  // Activa 6G — single BS6 variant, mainly for OEM color + AI-label demo.
  const activaId = vehicleIds["activa-6g"];
  if (activaId) {
    await prisma.vehicleVariant.upsert({
      where: { vehicleId_slug: { vehicleId: activaId, slug: "standard-bs6" } },
      create: {
        vehicleId: activaId,
        slug: "standard-bs6",
        name: "Standard (BS6)",
        emissionStandard: "BS6",
        startType: "Self",
        yearFrom: 2020,
        sortOrder: 0,
      },
      update: { emissionStandard: "BS6", startType: "Self", yearFrom: 2020 },
    });
    await prisma.vehicle.update({
      where: { id: activaId },
      data: {
        badgeText: "ACTIVA",
        ocrKeywords: ["ACTIVA", "ACTIVA 6G", "HONDA ACTIVA"],
        aiLabels: ["honda-activa", "automatic-scooter", "110cc-scooter"],
      },
    });
  }

  console.log("Catalog-engine demo data seeded.");
}

async function main() {
  console.log("Seeding vehicle manufacturers…");
  const manufacturerIds: Record<string, string> = {};
  for (let i = 0; i < MANUFACTURERS.length; i++) {
    const m = MANUFACTURERS[i];
    const record = await prisma.vehicleManufacturer.upsert({
      where: { slug: m.slug },
      create: { name: m.name, slug: m.slug, sortOrder: i },
      update: { name: m.name },
    });
    manufacturerIds[m.slug] = record.id;
  }

  console.log("Seeding vehicles…");
  const vehicleIds: Record<string, string> = {};
  for (let i = 0; i < VEHICLES.length; i++) {
    const v = VEHICLES[i];
    const record = await prisma.vehicle.upsert({
      where: { slug: v.slug },
      create: {
        name: v.name,
        slug: v.slug,
        category: v.category,
        manufacturerId: manufacturerIds[v.manufacturerSlug],
        engineCc: v.engineCc,
        searchAliases: v.searchAliases,
        sortOrder: i,
      },
      update: {
        name: v.name,
        category: v.category,
        manufacturerId: manufacturerIds[v.manufacturerSlug],
        engineCc: v.engineCc,
        searchAliases: v.searchAliases,
      },
    });
    vehicleIds[v.slug] = record.id;
  }

  await seedCatalogEngineDemo(manufacturerIds, vehicleIds);

  console.log(`Done — ${MANUFACTURERS.length} manufacturers, ${VEHICLES.length} vehicles.`);
}

main()
  .catch((err) => {
    console.error(err);
    process.exit(1);
  })
  .finally(() => prisma.$disconnect());
