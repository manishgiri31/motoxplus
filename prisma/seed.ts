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
  ];

  for (const cat of categories) {
    await prisma.category.upsert({
      where: { slug: cat.slug },
      update: {},
      create: cat,
    });
  }

  console.log("✓ Categories created");

  const brakeCategory = await prisma.category.findUnique({ where: { slug: "brake-parts" } });
  const engineCategory = await prisma.category.findUnique({ where: { slug: "engine-parts" } });

  // Sample products
  const products = [
    {
      name: "Disc Brake Pad Set - Honda Activa 5G",
      sku: "BRK-PAD-001",
      partNumber: "MXP-BRK-001",
      description: "OEM-compatible semi-metallic brake pads for Honda Activa 5G. High thermal resistance, low dust.",
      categoryId: brakeCategory!.id,
      price: 245,
      gstRate: 18,
      moq: 10,
      stock: 500,
      compatibility: ["Honda Activa 5G", "Honda Activa 6G"],
      images: [],
    },
    {
      name: "Front Drum Brake Assembly - TVS Jupiter",
      sku: "BRK-DRUM-002",
      partNumber: "MXP-BRK-002",
      description: "Complete front drum brake assembly. Direct OEM replacement.",
      categoryId: brakeCategory!.id,
      price: 890,
      gstRate: 18,
      moq: 5,
      stock: 150,
      compatibility: ["TVS Jupiter", "TVS Jupiter Classic"],
      images: [],
    },
    {
      name: "Engine Top Gasket Set - Hero Splendor Plus",
      sku: "ENG-GAS-001",
      partNumber: "MXP-ENG-001",
      description: "Complete top end gasket kit. High-temp silicone compound, multi-layer construction.",
      categoryId: engineCategory!.id,
      price: 320,
      gstRate: 18,
      moq: 10,
      stock: 800,
      compatibility: ["Hero Splendor Plus", "Hero Splendor iSmart"],
      images: [],
    },
  ];

  for (const product of products) {
    const existing = await prisma.product.findUnique({ where: { sku: product.sku } });
    if (!existing) {
      await prisma.product.create({ data: product });
    }
  }

  console.log("✓ Sample products created");

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
