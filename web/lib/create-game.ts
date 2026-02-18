import { prisma } from "@/lib/prisma";
import { deductStakesForGame } from "@/lib/ledger";

/**
 * Creates a game between two players and deducts stakes.
 * White/black assigned randomly.
 * Throws if either player has insufficient balance.
 */
export async function createGameBetweenPlayers(
  player1Id: string,
  player2Id: string,
  stake: number
) {
  const [p1, p2] = await Promise.all([
    prisma.user.findUnique({ where: { id: player1Id }, select: { id: true, balance: true } }),
    prisma.user.findUnique({ where: { id: player2Id }, select: { id: true, balance: true } }),
  ]);
  if (!p1 || !p2) throw new Error("Player not found");
  if (p1.balance < stake || p2.balance < stake) throw new Error("Insufficient balance");

  const whiteId = Math.random() < 0.5 ? player1Id : player2Id;
  const blackId = whiteId === player1Id ? player2Id : player1Id;

  const game = await prisma.game.create({
    data: { whiteId, blackId, stake, createdViaChallenge: true },
    include: {
      white: { select: { id: true, email: true, name: true, elo: true } },
      black: { select: { id: true, email: true, name: true, elo: true } },
    },
  });

  const ok = await deductStakesForGame(player1Id, player2Id, stake, game.id);
  if (!ok) throw new Error("Failed to deduct stakes");

  return game;
}
