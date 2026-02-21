import { NextResponse } from "next/server";
import { getSession } from "@/lib/auth";
import { prisma } from "@/lib/prisma";
import { settleGame, getUserBalance } from "@/lib/ledger";
import { getEloChanges } from "@/lib/elo";
import { executeOnChainSettlementAndUpdateGame } from "@/lib/settle-on-chain";
import { broadcastGameUpdate } from "@/lib/ws-notify";
import { logger } from "@/lib/logger";
import { apiError, unauthorized, forbidden, notFound } from "@/lib/api-response";

/**
 * The logged-in user accepts the disconnect forfeit (they were the one who disconnected).
 * Ends the game with the other player as winner. Same outcome as when the 60s timer fires.
 */
export async function POST(
  _request: Request,
  { params }: { params: Promise<{ id: string }> }
) {
  const session = await getSession();
  if (!session) return unauthorized();

  const { id: gameId } = await params;
  const userId = session.userId;

  try {
    const game = await prisma.game.findUnique({
      where: { id: gameId },
      include: {
        white: { select: { elo: true } },
        black: { select: { elo: true } },
      },
    });

    if (!game) return notFound("Game not found");
    if (game.status !== "active") {
      return NextResponse.json({ ok: true, game: await prisma.game.findUnique({ where: { id: gameId }, include: { white: { select: { id: true, email: true, name: true, elo: true } }, black: { select: { id: true, email: true, name: true, elo: true } } } }) });
    }
    if (game.disconnectedUserId !== userId) {
      return forbidden("You are not the disconnected player in this game");
    }
    if (game.whiteId !== userId && game.blackId !== userId) {
      return forbidden();
    }

    const disconnectedUserId = userId;
    const winnerId = disconnectedUserId === game.whiteId ? game.blackId : game.whiteId;

    const [whiteBalanceNow, blackBalanceNow] = await Promise.all([
      getUserBalance(game.whiteId),
      getUserBalance(game.blackId),
    ]);
    const stake = game.stake;
    const whiteBalanceBefore = whiteBalanceNow + stake;
    const blackBalanceBefore = blackBalanceNow + stake;

    await prisma.game.update({
      where: { id: gameId },
      data: { status: "disconnected", winner: winnerId, disconnectedUserId: null, disconnectedAt: null },
    });

    await settleGame(gameId, winnerId, disconnectedUserId, game.stake);

    let whiteEloAfter = game.white.elo;
    let blackEloAfter = game.black.elo;
    let eloWhiteDelta = 0;
    let eloBlackDelta = 0;
    if (!game.createdViaChallenge) {
      const winnerElo = winnerId === game.whiteId ? game.white.elo : game.black.elo;
      const loserElo = disconnectedUserId === game.whiteId ? game.white.elo : game.black.elo;
      const { winnerNew, loserNew } = getEloChanges(winnerElo, loserElo, false);
      await Promise.all([
        prisma.user.update({ where: { id: winnerId }, data: { elo: winnerNew } }),
        prisma.user.update({ where: { id: disconnectedUserId }, data: { elo: loserNew } }),
      ]);
      whiteEloAfter = winnerId === game.whiteId ? winnerNew : loserNew;
      blackEloAfter = winnerId === game.blackId ? winnerNew : loserNew;
      eloWhiteDelta = winnerId === game.whiteId ? winnerNew - game.white.elo : loserNew - game.white.elo;
      eloBlackDelta = winnerId === game.blackId ? winnerNew - game.black.elo : loserNew - game.black.elo;
    }

    await prisma.game.updateMany({
      where: {
        id: gameId,
        whiteBalanceBeforeCents: null,
        blackBalanceBeforeCents: null,
      },
      data: {
        whiteEloBefore: game.white.elo,
        blackEloBefore: game.black.elo,
        whiteEloAfter,
        blackEloAfter,
        whiteBalanceBeforeCents: whiteBalanceBefore,
        blackBalanceBeforeCents: blackBalanceBefore,
      },
    });

    logger.info("game_forfeit_disconnect_user_accepted", { gameId, disconnectedUserId, winnerId, stake: game.stake });

    const updatedGame = await prisma.game.findUnique({
      where: { id: gameId },
      include: {
        white: { select: { id: true, email: true, name: true, elo: true } },
        black: { select: { id: true, email: true, name: true, elo: true } },
      },
    });

    const gameOver = {
      winnerId,
      stake: game.stake,
      eloWhiteDelta,
      eloBlackDelta,
      isDraw: false,
    };

    broadcastGameUpdate({ gameId, game: updatedGame ?? undefined, gameOver });

    await executeOnChainSettlementAndUpdateGame(gameId, winnerId, disconnectedUserId, stake);

    return NextResponse.json({ ok: true, game: updatedGame, gameOver });
  } catch (e) {
    logger.error("forfeit_disconnect_error", { gameId, error: String(e) });
    return apiError("Forfeit failed", 500);
  }
}
