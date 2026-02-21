import { NextResponse } from "next/server";
import { getSession } from "@/lib/auth";
import { prisma } from "@/lib/prisma";
import { settleGame, getUserBalance } from "@/lib/ledger";
import { getEloChanges } from "@/lib/elo";
import { broadcastGameUpdate } from "@/lib/ws-notify";
import { executeOnChainSettlementAndUpdateGame } from "@/lib/settle-on-chain";
import { apiError, apiSuccess, unauthorized, forbidden, notFound } from "@/lib/api-response";
import { logger } from "@/lib/logger";

export async function POST(
  _request: Request,
  { params }: { params: Promise<{ id: string }> }
) {
  const session = await getSession();
  if (!session) return unauthorized();

  const { id: gameId } = await params;

  try {
    const game = await prisma.game.findUnique({
      where: { id: gameId },
      include: {
        white: { select: { id: true, elo: true, name: true, email: true } },
        black: { select: { id: true, elo: true, name: true, email: true } },
      },
    });

    if (!game) return notFound("Game not found");
    if (game.status !== "active") return apiError("Game not active", 400);
    if (game.whiteId !== session.userId && game.blackId !== session.userId) {
      return forbidden();
    }

    const resignedUserId = session.userId;
    const winnerId = resignedUserId === game.whiteId ? game.blackId : game.whiteId;

    const [whiteBalanceNow, blackBalanceNow] = await Promise.all([
      getUserBalance(game.whiteId),
      getUserBalance(game.blackId),
    ]);
    const stake = game.stake;
    const whiteBalanceBefore = whiteBalanceNow + stake;
    const blackBalanceBefore = blackBalanceNow + stake;

    // Orden: terminar partida + ledger primero, broadcast, luego on-chain (evita partida atascada si falla on-chain).
    await prisma.game.update({
      where: { id: gameId },
      data: {
        status: "resigned",
        winner: winnerId,
        drawOfferBy: null,
        chatStatus: null,
        chatInitiatedBy: null,
      },
    });

    await settleGame(gameId, winnerId, resignedUserId, game.stake);

    let whiteEloAfter = game.white.elo;
    let blackEloAfter = game.black.elo;
    let eloWhiteDelta = 0;
    let eloBlackDelta = 0;
    if (!game.createdViaChallenge) {
      const winnerElo = winnerId === game.whiteId ? game.white.elo : game.black.elo;
      const loserElo = resignedUserId === game.whiteId ? game.white.elo : game.black.elo;
      const { winnerNew, loserNew } = getEloChanges(winnerElo, loserElo, false);
      await Promise.all([
        prisma.user.update({ where: { id: winnerId }, data: { elo: winnerNew } }),
        prisma.user.update({ where: { id: resignedUserId }, data: { elo: loserNew } }),
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

    broadcastGameUpdate({ gameId, game: updatedGame, gameOver });
    await executeOnChainSettlementAndUpdateGame(gameId, winnerId, resignedUserId, stake);
    logger.info("game_ended", { gameId, status: "resigned", winnerId, stake: game.stake });
    return apiSuccess({ ok: true, game: updatedGame, gameOver });
  } catch (e) {
    logger.error("resign_error", { gameId, error: String(e) });
    return apiError("Error processing resignation", 500);
  }
}
