import { prisma } from "./prisma";

export type LedgerType = "deposit" | "stake" | "win" | "refund";

export async function addLedgerEntry(
  userId: string,
  amount: number,
  type: LedgerType,
  gameId?: string,
  description?: string
) {
  return prisma.ledgerEntry.create({
    data: { userId, amount, type, gameId, description },
  });
}

export async function getUserBalance(userId: string): Promise<number> {
  const user = await prisma.user.findUnique({
    where: { id: userId },
    select: { balance: true },
  });
  return user?.balance ?? 0;
}

export async function updateUserBalance(userId: string, delta: number) {
  return prisma.user.update({
    where: { id: userId },
    data: { balance: { increment: delta } },
  });
}

/**
 * Descuenta stake a ambos jugadores al empezar la partida.
 * Retorna true si ambos tienen saldo suficiente; false si no.
 */
export async function deductStakesForGame(
  player1Id: string,
  player2Id: string,
  stake: number,
  gameId: string
): Promise<boolean> {
  const [p1, p2] = await Promise.all([
    prisma.user.findUnique({ where: { id: player1Id }, select: { balance: true } }),
    prisma.user.findUnique({ where: { id: player2Id }, select: { balance: true } }),
  ]);
  if (!p1 || !p2 || p1.balance < stake || p2.balance < stake) {
    return false;
  }

  await prisma.$transaction([
    prisma.user.update({ where: { id: player1Id }, data: { balance: { decrement: stake } } }),
    prisma.user.update({ where: { id: player2Id }, data: { balance: { decrement: stake } } }),
    prisma.ledgerEntry.create({
      data: { userId: player1Id, amount: -stake, type: "stake", gameId, description: "Stake" },
    }),
    prisma.ledgerEntry.create({
      data: { userId: player2Id, amount: -stake, type: "stake", gameId, description: "Stake" },
    }),
  ]);
  return true;
}

/** Comisión de la plataforma: 5%. El ganador recibe 95% del bote. */
const PLATFORM_FEE_PERCENT = 0.05;

/**
 * Acredita al ganador el bote menos 5% de comisión, o devuelve las apuestas en empate.
 */
export async function settleGame(
  gameId: string,
  winnerId: string | null,
  loserId: string | null,
  stake: number
) {
  const pot = stake * 2;

  if (winnerId) {
    const winnerReceives = Math.floor(pot * (1 - PLATFORM_FEE_PERCENT));
    await prisma.$transaction([
      prisma.user.update({ where: { id: winnerId }, data: { balance: { increment: winnerReceives } } }),
      prisma.ledgerEntry.create({
        data: { userId: winnerId, amount: winnerReceives, type: "win", gameId, description: "Pot won (95%)" },
      }),
    ]);
  } else if (loserId === null) {
    // Empate: devolver stake a ambos jugadores de la partida
    const game = await prisma.game.findUnique({
      where: { id: gameId },
      select: { whiteId: true, blackId: true },
    });
    if (game) {
      await prisma.$transaction([
        prisma.user.update({ where: { id: game.whiteId }, data: { balance: { increment: stake } } }),
        prisma.user.update({ where: { id: game.blackId }, data: { balance: { increment: stake } } }),
        prisma.ledgerEntry.create({
          data: { userId: game.whiteId, amount: stake, type: "refund", gameId, description: "Draw" },
        }),
        prisma.ledgerEntry.create({
          data: { userId: game.blackId, amount: stake, type: "refund", gameId, description: "Draw" },
        }),
      ]);
    }
  }
}
