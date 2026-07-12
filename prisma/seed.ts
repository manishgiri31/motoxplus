import { PrismaClient } from "@prisma/client";
import bcrypt from "bcryptjs";

const prisma = new PrismaClient();

async function main() {
  console.log("🌱 Seeding database...");

  // Categories
  const categories = [
    {
      name: "Brake Parts", slug: "brake-parts", sortOrder: 1,
      description: "OEM-compatible braking components including disc brake assemblies, drum brake kits, brake pads, calipers, brake shoes, and master cylinders. Engineered for precise stopping power and long-lasting performance on all major two-wheeler models.",
    },
    {
      name: "Engine Parts", slug: "engine-parts", sortOrder: 2,
      description: "High-precision engine components including pistons, piston rings, cylinder gaskets, engine bearings, cam chains, tappets, and rocker arms. Manufactured to OEM tolerances for reliable performance and engine longevity.",
    },
    {
      name: "Suspension Parts", slug: "suspension-parts", sortOrder: 3,
      description: "Complete suspension components covering front fork assemblies, shock absorbers, fork seals, dust seals, bushings, and suspension springs. Designed to restore original ride comfort and road handling on motorcycles and scooters.",
    },
    {
      name: "Electrical Parts", slug: "electrical-parts", sortOrder: 4,
      description: "Certified electrical components including CDI units, stators, regulators, ignition coils, switches, horn buttons, self-start motors, and complete wiring harnesses. Tested for voltage compliance and long-term reliability.",
    },
    {
      name: "Transmission Parts", slug: "transmission-parts", sortOrder: 5,
      description: "Transmission and drivetrain components including gear sets, clutch plates, pressure plates, final drive chains, sprockets, and gear shift forks. Precision-machined for smooth gear engagement and extended drivetrain life.",
    },
    {
      name: "Body Parts", slug: "body-parts", sortOrder: 6,
      description: "Exterior body panels and trim components including front mudguards, rear mudguards, headlight visors, side panels, tank covers, seat covers, and mirrors. Made from high-grade ABS plastic with UV-resistant finish for colour retention and durability.",
    },
    {
      name: "Bearings", slug: "bearings", sortOrder: 7,
      description: "High-quality ball bearings and roller bearings for wheel hubs, steering heads, swingarms, and engine internals. Each bearing is sealed and pre-greased for smooth operation, corrosion resistance, and minimal maintenance.",
    },
    {
      name: "Brake Shoes", slug: "brake-shoes", sortOrder: 8,
      description: "Drum brake shoes formulated with friction compounds that deliver consistent braking performance across temperature ranges. Available for front and rear drums on all major Hero, Honda, TVS, and Bajaj two-wheelers.",
    },
    {
      name: "Clutch Plates", slug: "clutch-plates", sortOrder: 9,
      description: "Complete clutch plate sets including friction plates and steel drive plates. Manufactured with wear-resistant friction material for precise clutch engagement, smooth power delivery, and extended clutch life.",
    },
    {
      name: "Halogen Bulbs", slug: "halogen-bulbs", sortOrder: 10,
      description: "Premium halogen bulbs for headlights, tail lights, and indicators. Available in standard and high-lumen variants with P15D, BA20D, and T10 base types. Designed for direct OEM socket fit on all popular two-wheeler models.",
    },
    {
      name: "Horns", slug: "horns", sortOrder: 11,
      description: "Electric and air-pressure horns meeting CMVR sound level regulations. Compact disc-type and shell-type designs available for motorcycles and scooters with direct OEM connector compatibility and weatherproof construction.",
    },
    {
      name: "Indicators", slug: "indicators", sortOrder: 12,
      description: "Complete indicator assemblies including turn signal lamps, lens housings, and bulb holders for front and rear fitment. Manufactured with polycarbonate lenses for impact resistance and OEM-grade electrical connectors.",
    },
    {
      name: "Ball Racer", slug: "ball-racer", sortOrder: 13,
      description: "Steering head ball racer sets containing upper and lower caged ball bearings and race cups. Precision-ground races ensure smooth, play-free steering. Compatible with all major Hero, Honda, TVS, and Bajaj steering columns.",
    },
    {
      name: "Mudguard", slug: "mudguard", sortOrder: 14,
      description: "Front and rear mudguards manufactured from high-impact ABS plastic with UV-stabilised colour pigments. Engineered to match OEM contours for direct bolt-on installation. Available for all major Hero and Honda motorcycle models in factory-matched colours.",
    },
    {
      name: "Head Light Visor", slug: "head-light-visor", sortOrder: 15,
      description: "Headlight visor and nacelle assemblies providing a clean, OEM-matched replacement for broken or faded headlight surrounds. Made from durable ABS plastic with chrome or painted finish options for motorcycles and scooters.",
    },
    {
      name: "Cables", slug: "cables", sortOrder: 16,
      description: "Friction-free control cables — clutch, throttle, front brake, rear brake, speedometer, choke, seat lock, and gear cables — for motorcycles and scooters across Hero, Honda, Bajaj, TVS, Yamaha, Suzuki, Royal Enfield, and other major brands.",
    },
  ];

  for (const cat of categories) {
    await prisma.category.upsert({
      where: { slug: cat.slug },
      update: {},
      create: cat,
    });
  }

  console.log("✓ Categories seeded");

  // Super Admin
  const superAdminEmail = "superadmin@motoxplus.in";
  const existingSuperAdmin = await prisma.user.findUnique({ where: { email: superAdminEmail } });

  if (!existingSuperAdmin) {
    const password = await bcrypt.hash("SuperAdmin@123", 12);
    await prisma.user.create({
      data: {
        name: "Super Admin",
        email: superAdminEmail,
        password,
        role: "SUPER_ADMIN",
        admin: {
          create: { isSuperAdmin: true },
        },
      },
    });
    console.log("✓ Super Admin created: superadmin@motoxplus.in / SuperAdmin@123");
  }

  // Admin
  const adminEmail = "admin@motoxplus.in";
  const existingAdmin = await prisma.user.findUnique({ where: { email: adminEmail } });

  if (!existingAdmin) {
    const password = await bcrypt.hash("Admin@123456", 12);
    await prisma.user.create({
      data: {
        name: "Admin User",
        email: adminEmail,
        password,
        role: "ADMIN",
        admin: {
          create: { isSuperAdmin: false },
        },
      },
    });
    console.log("✓ Admin created: admin@motoxplus.in / Admin@123456");
  }

  // Test Dealer
  const dealerEmail = "dealer@testshop.in";
  const existingDealer = await prisma.user.findUnique({ where: { email: dealerEmail } });

  if (!existingDealer) {
    const password = await bcrypt.hash("Dealer@123456", 12);
    await prisma.user.create({
      data: {
        name: "Rajesh Kumar",
        email: dealerEmail,
        password,
        role: "DEALER",
        dealer: {
          create: {
            companyName: "Kumar Auto Parts",
            gstNumber: "27AAAAA0000A1Z5",
            ownerName: "Rajesh Kumar",
            phone: "+91 98765 43210",
            state: "Maharashtra",
            city: "Pune",
            address: "Shop No. 12, Auto Market",
            pincode: "411001",
            status: "ACTIVE",
          },
        },
      },
    });
    console.log("✓ Test Dealer created: dealer@testshop.in / Dealer@123456");
  }

  // Test Vendor
  const vendorEmail = "vendor@testparts.in";
  const existingVendorUser = await prisma.user.findUnique({ where: { email: vendorEmail } });

  if (!existingVendorUser) {
    const password = await bcrypt.hash("Vendor@123456", 12);
    await prisma.user.create({
      data: {
        name: "Suresh Patel",
        email: vendorEmail,
        password,
        role: "VENDOR",
        vendor: {
          create: {
            vendorCode: "VND-TEST-001",
            companyName: "Patel Auto Components",
            ownerName: "Suresh Patel",
            email: vendorEmail,
            phone: "+91 98765 11111",
            gstNumber: "24BBBBB0000B1Z3",
            panNumber: "BBBPP1234C",
            category: "MANUFACTURING_COMPONENTS",
            status: "APPROVED",
            creditDays: 30,
            address: "Plot 45, Industrial Area, Phase 2",
            city: "Ahmedabad",
            state: "Gujarat",
            pincode: "380015",
          },
        },
      },
    });
    console.log("✓ Test Vendor created: vendor@testparts.in / Vendor@123456");
  }

  console.log("✅ Seeding complete!");
}

main()
  .catch((e) => {
    console.error(e);
    process.exit(1);
  })
  .finally(async () => {
    await prisma.$disconnect();
  });
