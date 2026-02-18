/**
 * Pone el balance de todos los usuarios a 0 (solo dinero real).
 * Uso: node scripts/zero-balances.mjs
 */
import "dotenv/config";
import { PrismaClient } from "@prisma/client";

const prisma = new PrismaClient();

async function main() {
  const result = await prisma.user.updateMany({ data: { balance: 0 } });
  console.log("Balances puestos a 0:", result.count, "usuarios");
}

main()
  .catch((e) => {
    console.error(e);
    process.exit(1);
  })
  .finally(() => prisma.$disconnect());
