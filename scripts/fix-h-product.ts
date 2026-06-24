import { PrismaClient } from "@prisma/client";
const prisma = new PrismaClient();
async function main() {
  const result = await prisma.product.updateMany({
    where: { name: "H" },
    data: { name: "HEAD LIGHT VISOR CB SHINE N/M (TYPE-5)" },
  });
  console.log(`Fixed ${result.count} product(s)`);
}
main().finally(() => prisma.$disconnect());
