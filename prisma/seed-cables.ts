/**
 * Imports the friction-free cable catalog (clutch/throttle/brake/speedometer/
 * choke/seat-lock/gear cables across ~130 two-wheeler model groups) as
 * MOTOXPLUS products. Each source line becomes one Product with a
 * sequential MX-CB#### SKU/part number, a generated description, and
 * price = dealer Net Rate / mrp = printed MRP.
 * Run: npm run db:seed-cables
 */

import { PrismaClient } from "@prisma/client";
import { CABLE_SECTIONS } from "./data/cables-source";

const prisma = new PrismaClient();

const CATEGORY_SLUG = "cables";
const SKU_PREFIX = "MX-CB";

interface TypeInfo {
  label: string;
  action: string;
}

const TYPE_RULES: { re: RegExp; info: TypeInfo }[] = [
  { re: /^cable\s*kit/i, info: { label: "Cable Kit", action: "bundles the full set of control cables needed for a complete service in one pack" } },
  { re: /^clutch\s*\/\s*gear\s*outer/i, info: { label: "Clutch/Gear Outer Cable", action: "serves as a replacement outer casing with liner for clutch and gear cable assemblies" } },
  { re: /^seat\s*lock/i, info: { label: "Seat Lock Cable", action: "operates the seat lock mechanism for secure locking and unlocking of the seat" } },
  { re: /^spe?e?dor?\s*meter|^speedometer|^speedo\b|^spedometer/i, info: { label: "Speedometer Cable", action: "transmits rotational drive from the front wheel hub to the speedometer head for accurate speed and odometer readings" } },
  { re: /^front\s*(brake|barke)/i, info: { label: "Front Brake Cable", action: "connects the front brake lever to the drum brake mechanism for consistent lever feel and stopping response" } },
  { re: /^rear\s*brake/i, info: { label: "Rear Brake Cable", action: "connects the rear brake pedal or lever to the drum brake mechanism for reliable rear-wheel braking" } },
  { re: /^d\.?\s*comp/i, info: { label: "Decompression Cable", action: "operates the engine decompression valve for easier kickstarting" } },
  { re: /^gear\s*cable/i, info: { label: "Gear Cable", action: "operates the gear shift mechanism for smooth, precise gear changes" } },
  { re: /^choke/i, info: { label: "Choke Cable", action: "operates the carburetor choke plate for reliable cold starts" } },
  { re: /^clutch/i, info: { label: "Clutch Cable", action: "transmits clutch lever effort to the clutch release mechanism for smooth, predictable engagement" } },
  { re: /^throttle/i, info: { label: "Throttle Cable", action: "transmits throttle grip movement to the carburetor or throttle body for a precise, consistent acceleration response" } },
];

const FALLBACK_TYPE: TypeInfo = { label: "Control Cable", action: "transmits precise mechanical control input to the connected component" };

function parseItem(raw: string, group: string): { type: TypeInfo; vehicles: string[] } {
  for (const { re, info } of TYPE_RULES) {
    if (re.test(raw)) {
      let rest = raw.replace(re, "").trim();
      rest = rest.replace(/^cable\b/i, "").trim();
      rest = rest.replace(/^[-–]\s*/, "").trim();
      const vehicles = rest.length > 0
        ? rest.split("/").map((s) => s.trim()).filter(Boolean)
        : group.split("/").map((s) => s.trim()).filter(Boolean);
      return { type: info, vehicles };
    }
  }
  return { type: FALLBACK_TYPE, vehicles: group.split("/").map((s) => s.trim()).filter(Boolean) };
}

function buildDescription(typeLabel: string, action: string, vehicles: string[]): string {
  const vehicleText = vehicles.length > 0 ? vehicles.join(", ") : "a wide range of two-wheeler models";
  return (
    `MOTOXPLUS ${typeLabel} is a friction-free, OEM-compatible replacement engineered for ${vehicleText}. ` +
    `Built with a galvanized steel inner wire running through a PVC-coated, low-friction outer casing, it ${action}. ` +
    `Precision-crimped brass and zinc-plated ferrules and nipples match factory dimensions for direct bolt-on fitment without modification. ` +
    `Each cable is tested for consistent free play, smooth operation, and long service life under regular riding conditions. Made in India.`
  );
}

async function main() {
  console.log("Seeding Cables category...");
  const category = await prisma.category.upsert({
    where: { slug: CATEGORY_SLUG },
    update: {},
    create: {
      name: "Cables",
      slug: CATEGORY_SLUG,
      sortOrder: 16,
      description:
        "Friction-free control cables — clutch, throttle, front brake, rear brake, speedometer, choke, seat lock, and gear cables — for motorcycles and scooters across Hero, Honda, Bajaj, TVS, Yamaha, Suzuki, Royal Enfield, and other major brands.",
    },
  });
  console.log(`✓ Category ready: ${category.name} (${category.id})`);

  let counter = 0;
  let created = 0;
  let updated = 0;

  for (const section of CABLE_SECTIONS) {
    for (const item of section.items) {
      counter += 1;
      const sku = `${SKU_PREFIX}${counter.toString().padStart(4, "0")}`;
      const { type, vehicles } = parseItem(item.name, section.group);
      const displayVehicles = vehicles.length > 0 ? vehicles.join(" / ") : section.group;
      const name = `MOTOXPLUS ${type.label} — ${displayVehicles}`;
      const description = buildDescription(type.label, type.action, vehicles);

      const price = parseFloat(item.price.toFixed(2));
      const mrp = parseFloat(item.mrp.toFixed(2));

      const result = await prisma.product.upsert({
        where: { sku },
        create: {
          name,
          sku,
          partNumber: sku,
          description,
          categoryId: category.id,
          price,
          mrp,
          gstRate: 18,
          hsnCode: "87141090",
          moq: 1,
          stock: 0,
          brand: "MOTOXPLUS",
          warranty: "No Warranty",
          countryOfOrigin: "India",
          compatibility: vehicles,
          isActive: true,
        },
        update: {
          name,
          description,
          price,
          mrp,
          compatibility: vehicles,
          isActive: true,
        },
      });

      if (result.createdAt.getTime() === result.updatedAt.getTime()) {
        created += 1;
      } else {
        updated += 1;
      }
    }
  }

  console.log(`\n✓ Cables import complete: ${counter} products processed (${created} created, ${updated} updated).`);
  console.log(`  SKU range: ${SKU_PREFIX}0001 → ${SKU_PREFIX}${counter.toString().padStart(4, "0")}`);
}

main()
  .catch((err) => {
    console.error(err);
    process.exit(1);
  })
  .finally(() => prisma.$disconnect());
