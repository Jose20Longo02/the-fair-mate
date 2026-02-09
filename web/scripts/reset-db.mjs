/**
 * Borra todos los usuarios, partidas y datos relacionados.
 * Uso: desde /web ejecutar: node scripts/reset-db.mjs
 * O: npm run db:reset
 */
import "dotenv/config";
import { PrismaClient } from "@prisma/client";

const prisma = new PrismaClient();

async function main() {
  await prisma.gameReport.deleteMany({});
  await prisma.notification.deleteMany({});
  await prisma.ledgerEntry.deleteMany({});
  await prisma.gameChallenge.deleteMany({});
  await prisma.game.deleteMany({});
  await prisma.user.deleteMany({});
  console.log("Base de datos reseteada: usuarios, partidas, reportes, notificaciones, desafíos y movimientos eliminados.");
}

main()
  .catch((e) => {
    console.error(e);
    process.exit(1);
  })
  .finally(() => prisma.$disconnect());
