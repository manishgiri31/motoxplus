/**
 * Regenerates the description for every product from its name, category, and
 * vehicle compatibility.
 * Run: npx ts-node --compiler-options '{"module":"CommonJS"}' prisma/seed-descriptions.ts
 * Or add to package.json scripts and run: npm run db:seed-descriptions
 */

import { PrismaClient } from "@prisma/client";

const prisma = new PrismaClient();

// ---------------------------------------------------------------------------
// Category-specific description generators
// ---------------------------------------------------------------------------

const generators: Record<string, (name: string, compat: string[]) => string> = {
  "mudguard": (name, compat) => {
    const vehicles = compat.length > 0 ? compat.slice(0, 3).join(", ") : "major two-wheelers";
    return `MOTOXPLUS ${name} is an OEM-compatible replacement mudguard precision-engineered for ${vehicles}. Manufactured from high-impact ABS plastic with UV-resistant, colour-stable pigments for superior durability and long-lasting finish. Designed to match original OEM contours for a perfect bolt-on installation with no drilling or modifications required. Undergoes multi-point dimensional inspection for exact fitment with original mounting brackets. Made in India.`;
  },

  "head-light-visor": (name, compat) => {
    const vehicles = compat.length > 0 ? compat.slice(0, 3).join(", ") : "major two-wheelers";
    return `MOTOXPLUS ${name} is a precision-engineered OEM-replacement headlight visor and nacelle assembly for ${vehicles}. Made from high-grade ABS plastic with impact resistance for protection against road debris. Available in chrome and painted finish options. Designed for direct bolt-on fitment with original headlight and mounting bracket — no modifications required. Made in India.`;
  },

  "indicators": (name, compat) => {
    const vehicles = compat.length > 0 ? compat.slice(0, 3).join(", ") : "major two-wheelers";
    return `MOTOXPLUS ${name} is a complete OEM-compatible turn signal indicator assembly for ${vehicles}. Features polycarbonate lens housing for impact and UV resistance. Equipped with standard-base bulb socket and OEM-grade wire connectors for direct plug-and-play fitment. Certified for road compliance. Made in India.`;
  },

  "brake-parts": (name, compat) => {
    const vehicles = compat.length > 0 ? compat.slice(0, 3).join(", ") : "major two-wheelers";
    return `MOTOXPLUS ${name} is a high-performance braking component engineered for ${vehicles}. Manufactured to OEM dimensional tolerances for precise fit and consistent braking force. Friction materials are formulated to deliver stable stopping power across temperature ranges and wet/dry conditions. Drop-in replacement requiring no modifications. Made in India.`;
  },

  "brake-shoes": (name, compat) => {
    const vehicles = compat.length > 0 ? compat.slice(0, 3).join(", ") : "major two-wheelers";
    return `MOTOXPLUS ${name} are drum brake shoes engineered for ${vehicles}. Formulated with heat-resistant friction compound for consistent braking performance across all temperature and load conditions. Precision-shaped to match the original drum profile for even wear and maximum contact area. Direct OEM replacement. Made in India.`;
  },

  "bearings": (name, compat) => {
    const vehicles = compat.length > 0 ? compat.slice(0, 3).join(", ") : "major two-wheelers";
    return `MOTOXPLUS ${name} is a precision ball bearing designed for ${vehicles}. Sealed and pre-packed with high-temperature grease to prevent contamination and reduce maintenance. Ground races ensure smooth, low-friction operation. Meets IS/ISO dimensional standards for direct OEM replacement. Made in India.`;
  },

  "ball-racer": (name, compat) => {
    const vehicles = compat.length > 0 ? compat.slice(0, 3).join(", ") : "major two-wheelers";
    return `MOTOXPLUS ${name} is a complete steering head ball racer set for ${vehicles}, containing upper and lower caged ball bearing assemblies with hardened race cups. Precision-ground races guarantee smooth, play-free steering and reduced handlebar vibration. Direct OEM replacement with easy installation. Made in India.`;
  },

  "clutch-plates": (name, compat) => {
    const vehicles = compat.length > 0 ? compat.slice(0, 3).join(", ") : "major two-wheelers";
    return `MOTOXPLUS ${name} is a complete clutch plate set for ${vehicles}, including friction plates and steel drive plates. Friction material is engineered for smooth engagement and minimal heat build-up under sustained use. Precision-stamped steel plates maintain flatness for even clamping force. Direct OEM replacement. Made in India.`;
  },

  "halogen-bulbs": (name, compat) => {
    const vehicles = compat.length > 0 ? compat.slice(0, 3).join(", ") : "major two-wheelers";
    return `MOTOXPLUS ${name} is an OEM-specification halogen bulb for ${vehicles}. Tungsten halogen filament delivers bright, consistent illumination with a colour temperature matching factory headlights. Designed for direct socket fit with no wiring changes. Rated for extended service life under vibration conditions typical of two-wheelers. Made in India.`;
  },

  "horns": (name, compat) => {
    const vehicles = compat.length > 0 ? compat.slice(0, 3).join(", ") : "major two-wheelers";
    return `MOTOXPLUS ${name} is an electric horn for ${vehicles} meeting CMVR sound level regulations. Compact disc-type design with weatherproof construction for all-season use. Operates on standard 12V two-wheeler electrical systems with OEM terminal connectors. Delivers a clear, loud tone suitable for urban and highway riding. Made in India.`;
  },

  "electrical-parts": (name, compat) => {
    const vehicles = compat.length > 0 ? compat.slice(0, 3).join(", ") : "major two-wheelers";
    return `MOTOXPLUS ${name} is a certified electrical component for ${vehicles}. Tested for voltage tolerance, heat resistance, and long-term reliability in two-wheeler operating conditions. OEM-grade connectors ensure plug-and-play fitment with the vehicle's existing wiring harness. Made in India.`;
  },

  "engine-parts": (name, compat) => {
    const vehicles = compat.length > 0 ? compat.slice(0, 3).join(", ") : "major two-wheelers";
    return `MOTOXPLUS ${name} is a precision engine component for ${vehicles}. Manufactured to OEM dimensional tolerances using quality-certified alloys and materials. Undergoes rigorous dimensional inspection to ensure correct fit, sealing, and performance within the engine assembly. Direct OEM replacement. Made in India.`;
  },

  "suspension-parts": (name, compat) => {
    const vehicles = compat.length > 0 ? compat.slice(0, 3).join(", ") : "major two-wheelers";
    return `MOTOXPLUS ${name} is an OEM-compatible suspension component for ${vehicles}. Engineered to restore original ride comfort and road-holding characteristics. Manufactured from high-grade materials with surface treatments for corrosion and wear resistance. Direct replacement requiring no suspension geometry adjustment. Made in India.`;
  },

  "transmission-parts": (name, compat) => {
    const vehicles = compat.length > 0 ? compat.slice(0, 3).join(", ") : "major two-wheelers";
    return `MOTOXPLUS ${name} is a precision transmission component for ${vehicles}. Machined to OEM specifications for smooth, positive gear engagement. Manufactured from heat-treated alloy steel for durability under sustained torque loads. Direct OEM replacement ensuring correct gear ratios and shift feel. Made in India.`;
  },

  "body-parts": (name, compat) => {
    const vehicles = compat.length > 0 ? compat.slice(0, 3).join(", ") : "major two-wheelers";
    return `MOTOXPLUS ${name} is an OEM-compatible body panel for ${vehicles}. Manufactured from high-grade ABS plastic with UV-resistant pigments for long-lasting colour and resistance to weathering. Engineered to match original panel contours for a factory-fit appearance. Includes original mounting points for direct bolt-on installation. Made in India.`;
  },
};

function generateDescription(
  productName: string,
  categorySlug: string,
  compatibility: string[]
): string {
  const gen = generators[categorySlug] ?? generators["body-parts"];
  return gen(productName, compatibility);
}

async function main() {
  console.log("🔍 Fetching all products...\n");

  const products = await prisma.product.findMany({
    include: {
      category: { select: { slug: true, name: true } },
    },
    orderBy: { category: { name: "asc" } },
  });

  console.log(`Found ${products.length} products. Regenerating descriptions...\n`);

  let updated = 0;
  let failed = 0;

  for (const product of products) {
    const description = generateDescription(
      product.name,
      product.category.slug,
      product.compatibility
    );

    try {
      await prisma.product.update({
        where: { id: product.id },
        data: { description },
      });
      console.log(`  ✓ [${product.category.name}] ${product.name}`);
      updated++;
    } catch (err) {
      console.error(`  ✗ Failed: ${product.name} — ${err instanceof Error ? err.message : err}`);
      failed++;
    }
  }

  console.log(`\n✅ Done. Updated: ${updated}  Failed: ${failed}`);
}

main()
  .catch((err) => {
    console.error(err);
    process.exit(1);
  })
  .finally(() => prisma.$disconnect());
