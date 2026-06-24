import { PrismaClient } from "@prisma/client";
const prisma = new PrismaClient();
const img = await prisma.productImage.findFirst({
  where: { product: { name: { contains: "visor", mode: "insensitive" } } },
  include: { product: { select: { name: true } } },
});
console.log(JSON.stringify(img));
await prisma.$disconnect();
