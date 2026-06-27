import { PrismaClient } from "@prisma/client";
import bcrypt from "bcryptjs";

const prisma = new PrismaClient();

async function main() {
  console.log("🌱 Seeding database...");

  // Categories
  const categories = [
    { name: "Brake Parts", slug: "brake-parts", description: "Disc brakes, drum brakes, brake pads, calipers", sortOrder: 1 },
    { name: "Engine Parts", slug: "engine-parts", description: "Pistons, gaskets, bearings, engine internals", sortOrder: 2 },
    { name: "Suspension Parts", slug: "suspension-parts", description: "Shock absorbers, springs, fork seals", sortOrder: 3 },
    { name: "Electrical Parts", slug: "electrical-parts", description: "Stators, CDI, switches, wiring harnesses", sortOrder: 4 },
    { name: "Transmission Parts", slug: "transmission-parts", description: "Gear sets, clutch plates, chains", sortOrder: 5 },
    { name: "Body Parts", slug: "body-parts", description: "Panels, fairings, headlights, mirrors", sortOrder: 6 },
    { name: "Bearings",     slug: "bearings",     description: "Wheel bearings, steering bearings, engine bearings", sortOrder: 7 },
    { name: "Brake Shoes",  slug: "brake-shoes",  description: "Drum brake shoes for motorcycles and scooters",       sortOrder: 8 },
    { name: "Clutch Plates",slug: "clutch-plates",description: "Clutch friction and steel plates",                    sortOrder: 9 },
    { name: "Halogen Bulbs",slug: "halogen-bulbs",description: "Headlight and indicator halogen bulbs",               sortOrder: 10 },
    { name: "Horns",        slug: "horns",        description: "Electric horns and pressure horns",                   sortOrder: 11 },
    { name: "Indicators",   slug: "indicators",   description: "Indicator assemblies and turn signal lamps",          sortOrder: 12 },
    { name: "Ball Racer",       slug: "ball-racer",       description: "Ball racer sets for steering and wheels",             sortOrder: 13 },
    { name: "Mudguard",         slug: "mudguard",         description: "Front and rear mudguards for motorcycles and scooters", sortOrder: 14 },
    { name: "Head Light Visor", slug: "head-light-visor", description: "Headlight visors and visor assemblies",                 sortOrder: 15 },
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
            status: "APPROVED",
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
