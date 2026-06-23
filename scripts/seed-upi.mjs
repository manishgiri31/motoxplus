import { PrismaClient } from "@prisma/client";

const prisma = new PrismaClient();

const settings = [
  { key: "upi_id",              value: "5118678468276SB1024@mairtel" },
  { key: "upi_name",            value: "MotoXPlus India Private Limited" },
  { key: "upi_enabled",         value: "true" },
  { key: "bank_account_name",   value: "MotoXPlus India Private Limited" },
  { key: "bank_account_number", value: "7834839071" },
  { key: "bank_ifsc",           value: "AIRP0000001" },
  { key: "bank_account_type",   value: "Current" },
];

for (const s of settings) {
  await prisma.setting.upsert({
    where: { key: s.key },
    update: { value: s.value },
    create: { key: s.key, value: s.value },
  });
  console.log(`✓ ${s.key} = ${s.value}`);
}

await prisma.$disconnect();
console.log("Done.");
