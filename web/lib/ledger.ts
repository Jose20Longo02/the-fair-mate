import { prisma } from "./prisma";
import { PLATFORM_FEE_PERCENT } from "./commission";

export type LedgerType = "deposit" | "stake" | "win" | "refund" | "withdrawal" | "adjustment";

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
 * Deducts stake from both players at game start.
 * Uses SELECT ... FOR UPDATE to lock rows and prevent race conditions.
 * Returns true if both have sufficient balance; false otherwise.
 */
export async function deductStakesForGame(
  player1Id: string,
  player2Id: string,
  stake: number,
  gameId: string
): Promise<boolean> {
  try {
    await prisma.$transaction(async (tx) => {
      // Lock both user rows — prevents concurrent balance modifications
      const [p1] = await tx.$queryRawUnsafe<{ balance: number }[]>(
        `SELECT balance FROM users WHERE id = $1 FOR UPDATE`,
        player1Id
      );
      const [p2] = await tx.$queryRawUnsafe<{ balance: number }[]>(
        `SELECT balance FROM users WHERE id = $1 FOR UPDATE`,
        player2Id
      );

      if (!p1 || !p2 || p1.balance < stake || p2.balance < stake) {
        throw new Error("Insufficient balance");
      }

      await tx.user.update({ where: { id: player1Id }, data: { balance: { decrement: stake } } });
      await tx.user.update({ where: { id: player2Id }, data: { balance: { decrement: stake } } });
      await tx.ledgerEntry.create({
        data: { userId: player1Id, amount: -stake, type: "stake", gameId, description: "Stake" },
      });
      await tx.ledgerEntry.create({
        data: { userId: player2Id, amount: -stake, type: "stake", gameId, description: "Stake" },
      });
    });
    return true;
  } catch {
    return false;
  }
}

/**
 * Credits the winner: total pot (2× stake) minus platform commission (see config). Loser loses their stake; winner gets their stake back + opponent's stake minus 5% of total.
 * Refunds both players on a draw.
 * Uses SELECT ... FOR UPDATE to prevent race conditions on balance updates.
 */
export async function settleGame(
  gameId: string,
  winnerId: string | null,
  loserId: string | null,
  stake: number
) {
  if (winnerId) {
    const totalPot = 2 * stake;
    const feeCents = Math.floor(totalPot * PLATFORM_FEE_PERCENT);
    const winnerReceives = totalPot - feeCents; // e.g. stake=500 → 1000 - 50 = 950
    await prisma.$transaction(async (tx) => {
      await tx.$queryRawUnsafe(`SELECT id FROM users WHERE id = $1 FOR UPDATE`, winnerId);
      await tx.user.update({ where: { id: winnerId }, data: { balance: { increment: winnerReceives } } });
      await tx.ledgerEntry.create({
        data: { userId: winnerId, amount: winnerReceives, type: "win", gameId, description: `Total pot minus ${PLATFORM_FEE_PERCENT * 100}% commission` },
      });
    });
  } else if (loserId === null) {
    // Draw: refund stake to both players
    const game = await prisma.game.findUnique({
      where: { id: gameId },
      select: { whiteId: true, blackId: true },
    });
    if (game) {
      await prisma.$transaction(async (tx) => {
        await tx.$queryRawUnsafe(`SELECT id FROM users WHERE id = $1 FOR UPDATE`, game.whiteId);
        await tx.$queryRawUnsafe(`SELECT id FROM users WHERE id = $1 FOR UPDATE`, game.blackId);
        await tx.user.update({ where: { id: game.whiteId }, data: { balance: { increment: stake } } });
        await tx.user.update({ where: { id: game.blackId }, data: { balance: { increment: stake } } });
        await tx.ledgerEntry.create({
          data: { userId: game.whiteId, amount: stake, type: "refund", gameId, description: "Draw" },
        });
        await tx.ledgerEntry.create({
          data: { userId: game.blackId, amount: stake, type: "refund", gameId, description: "Draw" },
        });
      });
    }
  }
}
