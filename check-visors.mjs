import { PrismaClient } from '@prisma/client';
const p = new PrismaClient();
const r = await p.product.findMany({
  where: { name: { contains: 'visor', mode: 'insensitive' } },
  select: { id: true, name: true, partNumber: true, price: true, mrp: true, compatibility: true },
  take: 20,
  orderBy: { name: 'asc' }
});
console.log(JSON.stringify(r, null, 2));
console.log('\nTotal visor products:', r.length);
await p.$disconnect();
