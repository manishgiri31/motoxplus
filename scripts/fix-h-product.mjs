import { PrismaClient } from "@prisma/client";
const prisma = new PrismaClient();
const result = await prisma.product.updateMany({
  where: { name: "H" },
  data: { name: "HEAD LIGHT VISOR CB SHINE N/M (TYPE-5)" },
});
console.log(`Fixed ${result.count} product(s) named "H"`);
await prisma.$disconnect();
