import { PrismaClient } from "@prisma/client";
const prisma = new PrismaClient();

const hl = await prisma.product.findMany({
  where: { name: { contains: "H/L VISOR", mode: "insensitive" }, isActive: false },
  select: { name: true, partNumber: true },
  orderBy: { partNumber: "asc" },
});
console.log("H/L VISOR products:");
hl.forEach(p => console.log(`  ${p.partNumber} | ${p.name}`));

await prisma.$disconnect();
